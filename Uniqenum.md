# Uniqenum

Uniqenum is the answer to a question.

How to enforce uniqueness of enumerators - enumeration values - in C?

## The Context

Value uniqueness in enumerations is often assumed, but not always.

Sometimes, you want duplicate values, because two values mean the same thing.

Usually though, and as a default, you want every value to be unique.

And while auto-increment of uninitialized values makes this automatic for trivial enums, enums with complex initialization pattern could result in duplicate enum values, causing very subtle, hard to diagnose bugs.

Example:

```c
#include <linux/ioctl.h>

/* Let's say this header defines per-device command bases */
#define FOO_IOC_MAGIC   'F'
#define BAR_IOC_MAGIC   'B'

/* Directions and sizes defined elsewhere */
#define DIR_NONE    0
#define DIR_READ    1
#define DIR_WRITE   2
#define DIR_RDWR    (DIR_READ | DIR_WRITE)

#define SIZE_8      8
#define SIZE_16     16
#define SIZE_32     32

/* Macro to compose an ioctl code — similar to _IOC in Linux */
#define MAKE_CMD(dir, size, magic, nr) \
    (((dir) << 30) | ((size) << 16) | ((magic) << 8) | (nr))

/* Here’s the enum that gets messy */
enum foo_ioctl_cmd {
    FOO_GET_STATUS = MAKE_CMD(DIR_READ,  SIZE_16, FOO_IOC_MAGIC, 0x01),
    FOO_SET_STATUS = MAKE_CMD(DIR_WRITE, SIZE_16, FOO_IOC_MAGIC, 0x02),
    FOO_PING       = MAKE_CMD(DIR_NONE,  0,       FOO_IOC_MAGIC, 0x03),

    /* conditional or computed values */
#if defined(CONFIG_FOO_DEBUG)
    FOO_DEBUG_DUMP = MAKE_CMD(DIR_READ,  SIZE_32, FOO_IOC_MAGIC, 0x04),
#endif

    /* external reuse of constants */
    BAR_CLONE      = MAKE_CMD(DIR_RDWR,  SIZE_8,  BAR_IOC_MAGIC,
                              (FOO_GET_STATUS & 0xFF) + 1),  // computed from another
};

/* Later someone else adds: */
enum bar_ioctl_cmd {
    BAR_GET_STATS  = MAKE_CMD(DIR_READ,  SIZE_16, BAR_IOC_MAGIC, 0x01),
    BAR_CLONE      = MAKE_CMD(DIR_RDWR,  SIZE_8,  BAR_IOC_MAGIC, 0x02),  // oops, duplicate value!
};
```

If a bug causes duplicate enumerators to appear, it's hard to diagnose problem, especially in large, complex systems like the Linux kernel.

So you'd use:

```c
uniqenum2(bar_ioctl_cmd,
  BAR_GET_STATS, MAKE_CMD(DIR_READ,  SIZE_16, BAR_IOC_MAGIC, 0x01),
  BAR_CLONE, MAKE_CMD(DIR_RDWR,  SIZE_8,  BAR_IOC_MAGIC, 0x02),
)
```

## General syntax

```text
uniqenum<N: number of enumerators>(<enum-name>,
    <key1>,=<value1>,
    <key2>,=<value2>,
    <key3>,, // automatic value, 1 greater than the previous value
    ...
    <keyN>,=<valueN>,
<typedef-name>)
```

`enum-name` and `typedef-name` can be blank.

Usage:

```c
typedef uniqenum5(E1e,A1,=1,B1,=2,C1,=3,D1,=4,E1,=5,E1t); // typedef enum E1e{} E1t  named + typedef
typedef uniqenum5(,A2,=1,B2,=2,C2,=3,D2,=4,E2,=5,E2t);    // typedef enum{} E2t    typedef
uniqenum5(E3e,A3,=1,B3,=2,C3,=3,D3,=4,E3,=5,);            // enum E3e{}            named
uniqenum5(,A4,=1,B4,=2,C4,=3,D4,=4,E4,=5,);               // enum{}              anonymous
```

However sometimes you want to define not total uniqueness, but partial uniqueness. Allowing two or more "synonym" enumerators that resolve to the same underlying value.

This can be useful, for instance, to preserve an API.

In this case, we can split the enum declaration and uniqueness check:

```c
enum {
  A=1,
  B=2,
  C=3,
  C_synonym=3
}

_Static_assert(areuniq3(A,B,C), "Enum values must be unique");
_Static_assert(C == C_synonym, "Enum values and synonym must be equal");
```

`uniqenumN` is just a shorthand for enum definition + \_Static_assert of uniqueness. The two can be separated by exposing the uniqueness check expression as its own macro family, allowing for the preservation of the original enum syntax.

This reduces the learning curve and preserves code readability by avoiding hiding an enum definition behind a macro.

This can be useful to quickly enable uniqueness checking to existing code.

However, it does require repeating each enumerator. Which is why the shorthand `uniqenumN` is still provided.

## Formatted example

```c
typedef uniqenum6(color,
    BLACK,,
    RED,=0xff0000,
    GREEN,=0xff00,
    BLUE,=0xff,
    BLUEGREEN,BLUE | GREEN,
    REDGREEN,RED | GREEN,
color_t);
```

Preprocesses the following code (formatted)

```c
typedef enum color {
  BLACK,
  RED = 0xff0000,
  GREEN = 0xff00,
  BLUE = 0xff,
  BLUEGREEN = BLUE | GREEN,
  REDGREEN = RED | GREEN
} color_t;
_Static_assert(
      ((BLACK) != (RED))
    * ((BLACK) != (GREEN))
    * ((RED) != (GREEN))
    * ((BLACK) != (RED))
    * ((BLACK) != (BLUE))
    * ((RED) != (BLUE))
    * ((GREEN) != (BLUE))
    * ((BLACK) != (RED))
    * ((BLACK) != (BLUEGREEN))
    * ((RED) != (BLUEGREEN))
    * ((BLACK) != (RED))
    * ((BLACK) != (REDGREEN))
    * ((RED) != (REDGREEN))
    * ((BLUEGREEN) != (REDGREEN))
    * ((GREEN) != (BLUE))
    * ((GREEN) != (BLUEGREEN))
    * ((BLUE) != (BLUEGREEN))
    * ((GREEN) != (BLUE))
    * ((GREEN) != (REDGREEN))
    * ((BLUE) != (REDGREEN))
    * ((BLUEGREEN) != (REDGREEN)),
    "duplicate enum values: " "color" " " "color_t"
);
```

## ident(n): bijective identifier generation

ident(n) is an bijective, pure function that encodes a positive natural number into a valid C macro parameter name. It picks from available identifiers chars in this order:

- a-z
- A-Z
- \_, except for the first char
- 1-9
- 0, except for the first char

that's 26\*2=52 chars for the first char, and 52+1+10=63 fxor the other ones

Like in spreadsheet app columns, when we go above 63, we just add a new character, a new "digit" in this mixed-radix representation

we encode the most significant "digit" first, so the output is "stable" (ab,ac instead of ba,ca), i.e. its changes from the end, preserving a shared prefix accross iterations and visual symetry

## `areuniq` calculation

so how is the uniqueness check actually performed

the rules are:

- we have N integers
- we want zero if they are all different from each other, and non-zero otherwise

computation:

- take all unsorted pairs of values
- you'll have the binomial coefficient: $\binom{N}{2}$ pairs
- compute the difference between each: a-b, a-b, b-c...
- multiply all the differences together

if two values are equal to each other, the difference will be zero, the zero propagates across each factor, thus the whole product will be zero.

this is called the Vandermonde determinant, and code for it can be generated.

## the problem

$\binom{N}{2}$ scales quadratically. As N grows, we reach thousands, millions of pairs. This is obviously not acceptable, as file size explodes, and it could slow down significantly or even break compilation.

Therefore, I've been looking for ways to express `areuniq` in the fewest possible amount of bytes. I've considered the following

- linear simplification using static syntax helpers (express a subtraction in 5 tokes instead of 7 by calling this macro): too insiginificant, doesn't fix the quadratic binomial growth problem
- recursive helpers: we can expand helpers in powers of 2: `#define _2(a,b) ((a)-(b))`, `#define _4(a,b,c,d) _2(a,b)*_2(c,d)`. shorter to express long streches of subtractions, but it's the same problem as before: the number of pairs grows quadratically, therefore the savings offer diminishing returns as N grows. the problem isn't the syntax, it's the sheer number of terms.

which got me thinking. because `areuniq` isn't an unstructured blob of random subtractions. it's the Vandermonde determinant. Which is, in fact, very structured.

Which could mean that we could express it recursively. I've found multiple solution to express `areuniq` of $N$ based on smaller N or through additional macros:

| name            | description                                                                    | depth                     | dependencies                                             | code size (number of parameters spelled)          | helper macros required       |
| --------------- | ------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------- | ------------------------------------------------- | ---------------------------- |
| expanded        | product of all unsorted pair differences                                       | 1                         |                                                          | 2$\binom{N}{2}$                                   |
| row             | add a row to the right triangle: $v_{N-1} \times \prod_{i=1}^{N-1}(a_i - a_N)$ | $N - 1$                   | $N - 1$                                                  | best: $2N-1$, worst: $3N-2$                       | some; for the last row       |
| cliques ($k=3$) | represent pairs as complete graphs edges; split into $k$ subgraphs             | $\lceil\log_{k/2}N\rceil$ | $\lfloor\frac{2N}{K}\rfloor$, $\lceil\frac{2N}{K}\rceil$ | $kN-N$                                            |
| triangle        | split into middle square or near-rectangle and 2 half as big right triangles   | $\lceil\log_2N\rceil$     | $\lfloor\frac{N}{2}\rfloor$, $\lceil\frac{N}{2}\rceil$   | best: $2N$, worst: $N+\lfloor\frac{N²}{2}\rfloor$ | a lot: for the middle square |

Cliques appears to be the best method, so we'll use it.

## The cliques generation method

Instead of trying to find new representations, let's just do what always works: turn it into a graph.

- Vertices: parameters (a,b,c...)
- Edges: differences (a-b, b-c, etc)

$v_N$ can be represented as an undirected clique of N edges.

The clique edges form all unsorted pairs, reproducing the Vandermonde formula.

Now the challenge is as follows: to build the clique for N using smaller cliques of $M<N$, as few as possible, so that each parameter is stated as few times as possible.

The cost of a clique is the number of characters the minified implementation of it would require, not including unavoidable static costs (C syntax requirements, parens, etc). For the general case ($N>2$), the calculation is as follows:

- `len('areuniq')`
- `lendigits(N)`
- Sum for each sub-clique of size `M<N`:
  - 2: parens for the macro call
  - `len('areuniq')`
  - `lendigits(M)`
  - `M-1`: commas between parameters
  - Sum for each ident `m` vertex part of the sub-clique:
    - len(m)
- (number of sub-cliques)-1 : stars between each sub-clique to multiply them together

`lendigits(x)` is the number of digits to represent x in base 10.

We could reduce the cost of digitCounts and `areuniq` by turning the macro name in an ident(M) (but it would need careful handling to avoid being shadowed by macro parameters in the implementation part), but we'd be loosing readability for calls outside. Unless we provide an interface `#define areuniq4(a,b,c,d) D(a,b,c,d)` or something. but we loose one depth level. I doubt it's worth it, but it's possible that it is.

General Note: we should use `a!=b` instead of `a-b`. Longer, but avoid overflow problems with differences. We can still use `*` instead of `&&` though. Saves one byte.

### Summary of the idea (one sentence)

Represent the Vandermonde `v_N = ∏_{i<j} (a_i - a_j)` as a product of Vandermonde factors on smaller vertex subsets by covering the complete graph $K_N$ with smaller cliques. If every unordered pair ${i,j}$ is contained in at least one chosen clique, the product of Vandermonde determinants for those cliques is zero exactly when some pair is equal. Multiplicity of factors is allowed.

### Why this fixes the problems

- **Removes quadratic expansion**. We never emit every $\binom{N}{2}$ pair. We emit Vandermonde on smaller subsets and multiply them.
- **Cost / depth tradeoff is explicit**. A balanced k-partition at each level yields a simple analytic cost factor and a simple depth recurrence. This lets you pick k to meet depth D while minimizing emitted token count.
- **Keeps semantics**. Multiplying factors multiple times does not change the zero/non-zero property used by `_Static_assert`.
- **Generatable**. The structure is regular. A code generator (Python) can emit the macro tree automatically using the ident scheme you already designed.

### Math: cost and depth for k-partitions

Partition $V$ into $k$ nearly-equal parts $V*1..V_k$. Take one clique for each unordered pair $i<j$: $C*{ij}=V_i\cup V_j$.

- Number of cliques: $\binom{k}{2}$.
- Each clique size ≈ $2n/k$.
- Top-level cost factor $= \frac{\sum |C\_{ij}|}{n} \approx (k-1)$. (Derivation: each part appears in (k-1) of the unions, so total = ((k-1)n).)
- Depth recurrence: $\text{depth}(n) \le 1 + \text{depth}(\lceil 2n/k \rceil)$.

Tradeoff:

- Larger k increases cost linearly (factor $k-1$).
- Larger k decreases depth (smaller child size).
- k must be $\ge 3$ to avoid producing full-size clique.

### Practical choices for N ≤ 1e6 and D = 200

- k = 3 gives cost factor $=2$ (optimal $2N$) and depth ~ $\log\_{3/2} N$. For $N=10^6$ depth ≈ 35. Well below 200.
- k = 4 gives factor $=3$ and depth ~ $\log_2 N$ (~20).
- Therefore pick k = 3 everywhere unless you have other constraints. It minimizes emitted byte-count while keeping depth tiny.

### Construction algorithm (high-level)

1. Input: N, ident naming scheme & base-case max `B` (e.g. B ≤ 64 or whichever small macro size you will implement directly).
2. Partition indices $1..N$ into 3 nearly equal blocks $V_1,V_2,V_3$. (Use floor/ceil to distribute evenly.)
3. Emit a macro `areuniq_N(a1,...,aN)` defined as:

   ```c
   areuniq_N(...) = areuniq_{|C12|}( args for indices in C12 )
                 * areuniq_{|C13|}( args for indices in C13 )
                 * areuniq_{|C23|}( args for indices in C23 )
   ```

   where `Cij = Vi ∪ Vj`.

4. Recurse inside each `areuniq_M` until `M <= B` and emit a concrete base macro that directly multiplies the B(B-1)/2 differences (or uses your triangular helper code if you prefer).
5. When constructing the call sites, use your `ident(n)` generator to produce stable parameter names and keep parameter order consistent (so helper macros can be reused).

This gives a 3-ary recursion tree. Calls are regular and parameter slicing is mechanical.

### Example: N = 9 (concrete)

Partition 9 into V1={1,2,3}, V2={4,5,6}, V3={7,8,9}.

Top-level:

```c
areuniq9(a1..a9) =
  areuniq6( a1,a2,a3, a4,a5,a6 )   // C12
* areuniq6( a1,a2,a3, a7,a8,a9 )   // C13
* areuniq6( a4,a5,a6, a7,a8,a9 )   // C23
```

Then `areuniq6` recurses the same way until base `areuniq_B` are expanded into explicit factors.

Note: pairs like (a1,a4) appear in `areuniq6` C12 and (a1,a7) in C13 etc. Some pairs can appear multiple times; that is acceptable.

### Complexity and resource expectations

- For k=3 recursion:
  - Top-level emitted parameter count per level = $(k-1)N = 2N$ tokens representing identifiers. The total emitted identifiers across the whole recursion tree is roughly $O(N \* \text{depth})$ but depth ≈ 35 for 1e6 so worst-case emitted tokens ≈ $70N$ ident tokens if you literalize everything. In reality your generator will reuse helpers and `base_B`, so emitted file size will be far smaller.

- Preprocessor limits:
  - C compilers have limits on macro argument count and macro expansion depth. Keep `base_B` small to avoid giant immediate macros. The recursion keeps any single macro's parameter count bounded by `N` only at top-level call site, which is unavoidable if you want `AREUNIQ_N(a1..aN)` syntax. If N itself is huge $1e6$, that single call will be enormous and likely hit compiler limits. Practical constraint: avoid requiring a single macro with 1e6 parameters. Instead require the user to break calls into chunks or provide a wrapper that generates the call site with generated identifier lists. (The generator can also emit a special `AREUNIQ_1e6` that has fewer parameters by shifting some grouping into nested macros so top-level call sites remain manageable.)
  - Recommendation: set a practical cap on `max_N` for a single macro call (e.g. 65535 or the compiler’s limit). For larger semantic N, provide a different API that uses multiple `_Static_assert` calls across grouped enum fragments.

### Practical recommendations (defaults)

- Use k = 3 everywhere. It is cost-optimal $2N$ and depth is tiny for N ≤ 1e6.
- Choose `base_B = 16` or 32 for direct expansion.
- Emit both human-readable and minified header variants. Use minified in production builds.
- Build a small CLI that produces the header on demand. Do not hand-write big macros.
Parameter naming uses your `ident(i)` for stable short identifiers.

### Edge cases and notes

- For very small N (2,3) provide trivial macros.
- If the user needs the *exact* Vandermonde product (no duplicated factors) for some reason, this method does not give uniqueness of multiplicity. But for `_Static_assert(areuniq)`, multiplicity is irrelevant.
- Compiler preprocessor time may still be nontrivial. Test build times. Use minified output to trim parse time.
- If target compilers enforce low macro parameter count, split your `uniqenum` API so that the user supplies smaller groups. The generator can then produce glue macros that combine groups.

## Splitting by files: dependency management

Now that we have a way to express `areuniq` on any N with reasonably short code, we have to tackle distribution of the macros.

Our use case is as follows: to import the `areuniq` (and `uniqenum`) macro for a specific N, with a minimal preprocessing cost.

A solution is to split the macros in multiple headers, restricting the amount of code the preprocessor needs to parse, at the cost of having more files.

While we could split by amount of macros (e.g. allowing 100 macros by file), this would make the actual code size variable and difficult to predict; so the preferred solution is fixed file size splitting.

However there is a problem. `areuniq` is not self contained. With the cliques generation, `areuniq` of $N$ depends on `areuniq` of $\lfloor\frac{2N}{3}\rfloor$ and $\lceil\frac{2N}{3}\rceil$.

This means these smaller `areuniq` macros (and their own dependencies, recursively), must be in scope at the time we call `areuniq`.

This means we generate include statements that point to smaller headers. Each header corresponds to a specific range of N values.

We write code in a header until our size would go above 262144 bytes, then we move to a new header.

For instance, for max N=512:

| \#  | Min N | Max N (incl) | First macro deps | Last macro deps | Number of macros |
| --- | ----- | ------------ | ---------------- | --------------- | ---------------- |
| 0   | 2     | 250          |                  | 166,167         | 249              |
| 1   | 251   | 350          | 167,168          | 233,234         | 100              |
| 2   | 351   | 427          | 234              | 284,285         | 77               |
| 3   | 428   | 491          | 285,286          | 327,328         | 64               |
| 4   | 492   | 512          | 328              | 341,342         | 21               |

H1 can depend on H0

H2 though needs to depend on both H0 and H1

H3 and H4 can depend on H1

Since the number of macros per header naturally decreases (as bytes per macro increase but max size stays constant), we can expect that later headers will depend on a smaller N range, and will therefore depend on only one header.

The exception is H2 here, which is too large to depend only on H0, but it would be much smaller (max N 375, expressing only 25 macros instead of 77) if we didn't allow it to depend on H1 too.

## Choosing an assertion pattern

We have two approches to express the static assertions in `uniqenum`

### Asserting once

Build the `areuniq` macros as expressions, multiplications of the inequality of each pair.

For `uniqenum` of N, we can `_Static_assert` the result of `areuniq` of N.

- Pro: only one assertion
- Con: it grows very complex, performing at least $\binom{N}{2}$ checks per evaluation, slowing down compilation
- Con: a failure just shows the existence of duplicates, not which enumerators have duplicate values

### Asserting all

Build the `areuniq` macros as `_Static_assert` statements.

- Pro: asserts every pair independently, giving accurate diagnostics of which pair was equal
- Con: the number of static assertions grows with the number of paris, slowing down compilation
- Con: `areuniq` is no longer an expression and is less reusable as a result

### Choosing between the two

An informed choice would require benchmarking of compilation times and memory usage, but asserting once seems better on the long run: only one assertion, reusable `areuniq`

Though asserting all pairs becomes increasingly useful as N grows as it provides accurate diagnostics of which pair was duplicated.

This information is sometimes inferable from context when editing the enum directly, though if editing a macro results in the creation of a duplicated value, without a per-pair diagnostic it'll be unclear which pair was duplicated and the programmer will have to check the value of each enumerator manually.

## Self contained packing headers

For simplified usage, we will provide self-contained `areuniq`/`uniqenum` headers with a bounded size (with a defined increment of say 128kb) for all N in the interval `[2;R]`

Those headers will be provided in the `samples/` directory and downloadable from GitHub.
