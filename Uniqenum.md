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
  <enumerator1>,<value1>,
  <enumerator2>,<value2>,
  ...
  <enumeratorN>,<valueN>
<typedef-name>)
```

`enum-name` and `typedef-name` can be blank.

Usage:

```c
typedef uniqenum5(E1e,A1,1,B1,2,C1,3,D1,4,E1,5,E1t); // typedef enum E1e{} E1t  named + typedef
typedef uniqenum5(,A2,1,B2,2,C2,3,D2,4,E2,5,E2t);    // typedef enum{} E2t    typedef
uniqenum5(E3e,A3,1,B3,2,C3,3,D3,4,E3,5,);            // enum E3e{}            named
uniqenum5(,A4,1,B4,2,C4,3,D4,4,E4,5,);               // enum{}              anonymous
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

## Example

Example for N=5

The exact macro names are subject to change; this is only a sketch.

```c
#define uniqenum5(name,f,a,g,b,h,c,i,d,j,e,type)enum name{f=(a),g=(b),h=(c),i=(d),j=(e)}type;_Static_Assert(areuniq5(a,b,c,d,e),"enum values must be unique")
#define areuniq5(a,b,c,d,e) ((a)-(b))*((a)-(c))*((a)-(d))*((a)-(e))*((b)-(c))*((b)-(d))*((b)-(e))*((c)-(d))*((c)-(e))*((d)-(e))
```

The parameter names are consistent. For `uniqenum`, the first and last parameters are always `name` and `type` (for the enum name and typedef name).

The following values are generated using the ident function, but not in left to right order.

Indeed, in order to save as many bytes as possible, we need to reserve the shortest identifiers for values, keeping the longest ones for enumerators. Because we spell each value at least twice, and each enumerator only once. Therefore, we use this pattern:

| Ident # | used as |
| ------- | ------- |
| 1       | value 1 |
| 2       | value 2 |
| N       | value N |
| N + 1   | key 1   |
| N + N   | key N   |

hence the intermixed "f,a,g,b,h..." you're seeing.

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

Therefore, I've been looking for ways to express `areuniqN` in the fewest possible amount of bytes. I've considered the following

- linear simplification using static syntax helpers (express a subtraction in 5 tokes instead of 7 by calling this macro): too insiginificant, doesn't fix the quadratic binomial growth problem
- recursive helpers: we can expand helpers in powers of 2: `#define _2(a,b) ((a)-(b))`, `#define _4(a,b,c,d) _2(a,b)*_2(c,d)`. shorter to express long streches of subtractions, but it's the same problem as before: the number of pairs grows quadratically, therefore the savings offer diminishing returns as N grows. the problem isn't the syntax, it's the sheer number of terms.

which got me thinking. because `areuniqN` isn't an unstructured blob of random subtractions. it's the Vandermonde determinant. Which is, in fact, very structured.

Which... could mean that we could express it recursively.

## solution: recursion, rows & triangles

### Triangles: Recursion and You and You and You and You and You

We'll abbreviate `areuniqN` as `vN` from now on.

right triangle representation of Vandermonde determinant

for N=7:

```text
(a-b)
(a-c)(b-c)
(a-d)(b-d)(c-d)
(a-e)(b-e)(c-e)(d-e)
(a-f)(b-f)(c-f)(d-f)(e-f)
(a-g)(b-g)(c-g)(d-g)(e-g)(f-g)
```

N can be expressed in terms of N-1 by simply adding a row to the triangle. This is the **row** (N-1, linear) recursion method.

### Triangle recursion method

There is also a logarithmic recursion method. You can express vN in terms of vN/2, by splitting the triangle in three parts

- bottom left rectangle of width floor(N/2) and height ceil(N/2)
- two smaller rectangle triangles:
  - of height N/2-1 if N is even
  - one of height floor((N-2)/2), one of height ceil((N-2)/2) if N is odd
- recursive calls:
  - $\lceil\frac{N}{2}\rceil$ and $\lfloor\frac{N}{2}\rfloor$

Example for N=9:

```text
(a-b)
(a-c)(b-c)
(a-d)(b-d)(c-d)
(a-e)(b-e)(c-e)(d-e)
(a-f)(b-f)(c-f)(d-f)(e-f)
(a-g)(b-g)(c-g)(d-g)(e-g)(f-g)
(a-h)(b-h)(c-h)(d-h)(e-h)(f-h)(g-h)
(a-i)(b-i)(c-i)(d-i)(e-i)(f-i)(g-i)(h-i)
```

Split center rectangle:

4\*5

```text
(a-e)(b-e)(c-e)(d-e)
(a-f)(b-f)(c-f)(d-f)
(a-g)(b-g)(c-g)(d-g)
(a-h)(b-h)(c-h)(d-h)
(a-i)(b-i)(c-i)(d-i)
```

$$
x_{W.H}=\prod_{w\in W}\prod_{h\in H}(w-h)
$$

### Recursion sequence

base case is at $N=2$ (just one difference: a-b)

Triangle method gives $\lceil\frac{N}{2}\rceil$ and $\lfloor\frac{N}{2}\rfloor$ recursion:

- depth: $\log_2N-1$.
- Max: $\log_2N-1 = 200 \Harr N = 2^{201}$.
- Not quadratic in terms of code size, but requires a lot of helpers for rects.

Row method gives $N-1$ recursion:

- $N-1$ depth.
- Max: $N-1 = 200 \Harr N = 201$.
- Fully linear, bounded set of helpers needed (alwas (<=64).1 cross differences)

201 is not enough, but we will never need anything even remotely close to $2^{201}$. So the optimal layout is somewhere in between: using both rows and triangles.

We could define a reasonable maximum for N at $N=10^6$

so we want all N up to $10^6$ to require not more than 200 macro calls.

This means we have a "budget" of 200 recursive calls.

log2(10^6) = 19.93.., almost 20

question: for each N, when to use row or triangle method so that the depth required to express N<=10^6 is always <= 200.

then: check if continuous: does the required depth always grow with N? can we expect issues if we forget to account that

facts:

- our recursion limit is 200.
- triangle recursion should be as rare as possible in order to consume all our budget, since they are longer to express and require more helpers.
- triangle recursion is more efficient at big N, (N/2, goes down faster), whereas row recursion is constant (always N-1)

### restating the problem as highway construction

I have a math problem i thought you could help me solve.
We have the following Constants:
D=200, max distance
N=10⁶, max N

We are working in a one dimensional space of natural numbers starting from 2 to N inclusive.

A metaphor for the problem: We're a civil engineering firm designing a highway system with the goal of connecting all towns (values of N) to the capital (n=2) by placing either highways or rural roads in each.
Since highways are much more expensive and disrupting, we want to place as few highways as possible to connect every town while keeping the total distance from any town to the capital <= D

How distance(n) is calculated:

For any n in [2;N], we can compute its "distance" from 2 (which has a distance to itself of 0) as:

- 0 if n = 2
- 1 + distance(ceil(n/2)) if n is a highway
- 1 + distance(n - 1) otherwise (n is a rural road)

We can start by considering there are roads everywhere.

Goal : place the minimal amount of highways to ensure every town is connected to the capital by a distance <= D.

Precision: any distance for N is fine, as long as it is <= D. There's no preference between a distance of 1 or 200. There also no need for the distance to be proportional to n.

All that matters is distance(n) <= D for all n in [2;N]

## ~~possible solution: representing Vandermonde as a self-similar structure~~

Since our goal is to use helpers to minimize restating of terms.

So each helper macro should use its terms as much as possible. the best function at doing that is Vandermonde itself, since it factors all unsorted pair differences.

so drop cross differences (the xW_H business with the squares in the center of the right triangle representation) it does not help.

instead build vN from multiples v of smaller N, effectively paving a right triangle from right triangles.

### Attempt 1

vN can be minimally represented not by specific letters but by the differences between the index of each. For instance for v3: if a is 1, b is 2, c is 3: it is doing (1-2)(2-3)(1-3), basically (1)(1)(2) if we use absolutes. we should use absolutes to stay in positive, since our pairs are unsorted we shouldn't get duplicates.

Doing (1-2),(a-b) or (2-1),(b-a) is a convention choice. We choose to put the lowest first. to maintain consistency.

A new representation: grouping factors by distance between indices, i.e., all pairs separated by the same offset.

For N=9:

```text
Δ1: (a-b)(b-c)(c-d)(d-e)(e-f)(f-g)(g-h)(h-i)
Δ2: (a-c)(b-d)(c-e)(d-f)(e-g)(f-h)(g-i)
Δ3: (a-d)(b-e)(c-f)(d-g)(e-h)(f-i)
Δ4: (a-e)(b-f)(c-g)(d-h)(e-i)
Δ5: (a-f)(b-g)(c-h)(d-i)
Δ6: (a-g)(b-h)(c-i)
Δ7: (a-h)(b-i)
Δ8: (a-i)
```

The number of factors at row Δm is $N-m$.
I
Is this self-similar

Yes. vN is N-1 Δ1 factors, N-2 Δ2 factors, ..., up to 1 ΔN-1 factor.

Meaning we can place any smaller vN in the right triangle: like v3 which is 1,1,2. It uses two factors and one below.

We can decompose the right triangle in four smaller ones:

- two at the bottom edge of N $\lceil\frac{N}{2}\rceil$ and $\lfloor\frac{N}{2}\rfloor$ (like earlier)
- two halves of the central square. When N is even, they won't be symmetrical, one will be one unit smaller.

Decomposition for N=6

```text
1 1 1 1 1 1
2 2 2 2 2
3 3 3 3
4 4 4
5 5
6
```

Top right triangle:

```text
1 1 1
2 2
3
```

Bottom left triangle:

```text
4 4 4
5 5
6
```

Square decomposition (top left)

```text
1 1 1
2 2
3
```

bottom right

```text
  2
3 3
```

Clearly it doesn't work, it's not self similar.

## new approach: Clique model

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

General Note: we should use `a!=b` instead of `a-b`. Longer, but avoid overflow problems with differences. We can still use `*` instead of `&&` though.

Accepted. I’ll continue the document. Short, formal, implementation-ready.

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

### Implementation plan (practical)

1. **Generator script** (Python recommended)
   - Inputs: `max_N`, `base_B`, `k` (default 3), `ident_charset` rules, output header path.
   - Produces a single header `areuniq_generated.h` with:
     - `ident(n)` function used to name macro parameters inside emitted macros.
     - Base-case macros `AREUNIQ_B` for `B <= base_B`. (Base_B chosen to keep direct expansion manageable and under compiler macro-param limits.)
     - Recursive macros `AREUNIQ_m` for each m that is produced by recursion up to `max_N`.

   - The script slices parameter lists deterministically so helper macros are reusable.
   - Option: emit `uniqenumN` wrappers that place the enum body then call the `AREUNIQ_N` static assert.

2. **Macro naming conventions**
   - `AREUNIQ_N(...)` uppercase for generated macros.
   - `AREUNIQ_B_BASE(...)` for base-case direct expansion.
   - Keep a small constant prefix to avoid collisions.

3. **Parameter ordering**
   - Keep parameters in natural order by index. For `Cij = Vi ∪ Vj`, parameters are listed `Vi` then `Vj`. This keeps sharing high across macros and makes emitted calls compact (shared prefixes in a textual minifier).

4. **Base case**
   - For `M <= base_B` expand directly either
     - as product of `(a_i - a_j)` for all i<j, or
     - use your triangular helper macros to compress the row product if you already have those small helpers.

   - Choose base_B so that direct expansion fits within compiler macro-argument and source-file size limits. `base_B = 16` or `32` is a conservative default; you can raise it if CI proves fine.

5. **Minification and token-count**
   - The generator can produce a compact, token-minified output (no whitespace, short macro names) for production headers used in builds. Development output can be pretty printed.

6. **Integration into uniqenum**
   - `uniqenumN(...)` expands to `enum ... { ... }` followed immediately by `_Static_assert(AREUNIQ_N(...), "uniqenum: duplicate")`.
   - Provide both `uniqenumN` and `AREUNIQ_N` exported. This preserves the two-stage API (plain enum + manual assert) and the shorthand `uniqenumN`.

7. **Tests**
   - Unit tests: small N values compile and fail correctly on intentional duplicates.
   - Stress tests: generate 10k-100k small headers and test compile-time usage to ensure macro-parameter limits and preprocessor time are acceptable.

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

### Example generator pseudo-code (skeleton)

```python
def emit_areuniq(n):
    if n <= BASE_B:
        emit_base_macro(n)
        return
    v1, v2, v3 = split_three(n)
    # C12 indices: [0..v1+v2-1], etc
    emit_macro_header(n)
    emit("AREUNIQ_%d(...)= AREUNIQ_%d(args for C12) * AREUNIQ_%d(args for C13) * AREUNIQ_%d(args for C23)" %
         (n, v1+v2, v1+v3, v2+v3))
    emit_macro_footer(n)
    emit_areuniq(v1+v2); emit_areuniq(v1+v3); emit_areuniq(v2+v3)
```

Parameter naming uses your `ident(i)` for stable short identifiers.

### Edge cases and notes

- For very small N (2,3) provide trivial macros.
- If the user needs the *exact* Vandermonde product (no duplicated factors) for some reason, this method does not give uniqueness of multiplicity. But for `_Static_assert(areuniq)`, multiplicity is irrelevant.
- Compiler preprocessor time may still be nontrivial. Test build times. Use minified output to trim parse time.
- If target compilers enforce low macro parameter count, split your `uniqenum` API so that the user supplies smaller groups. The generator can then produce glue macros that combine groups.

### Final short checklist to implement

1. Write Python generator implementing k=3 recursion and your `ident` naming.
2. Choose base_B and implement base-case expansion.
3. Emit `AREUNIQ_*` macros up to requested `max_N` and wrappers `uniqenum*`.
4. Add tests for correctness and performance.
5. Ship minified header and readable header.
