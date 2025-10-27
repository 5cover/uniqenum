# Uniqenum

Uniqenum is the answer to a question.

How to enforce uniqueness of enumerators - enumeration values - in C?

## The Context

Value uniqueness innumerations is often assumed, but not always.

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

If a bug causes duplicate enumerators to appear, it's hard to diagnose problem, especially in large, complex systems like the Linux kernel

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

`uniqenumN` is just a shorthand for enum definition + _Static_assert of uniqueness. The two can be separated by exposing the uniqueness check expression as its own macro family, allowing for the preservation of the original enum syntax.

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

The parameter names are consistent. For uniqenum, the first and last parameters are always `name` and `type` (for the enum name and typedef name).

The following values are generated using the ident function, but not in left to right order.

Indeed, in order to save as many bytes as possible, we need to reserve the shortest identifiers for values, keeping the longest ones for enumerators. Because we spell each value at least twice, and each enumerator only once. Therefore, we use this pattern:

Ident #|used as
-|-
1|value 1
2|value 2
N|value N
N + 1|key 1
N + N|key N

hence the intermixed "f,a,g,b,h..." you're seeing.

## ident(n): injective identifier generation

ident(n) is an injective, deterministic function that encodes a positive natural number into a valid C macro parameter name. It picks from available identifiers chars in this order:

- a-z
- A-Z
- _, except for the first char
- 1-9
- 0, except for the first char

that's 26*2=52 chars for the first char, and 52+1+10=63 fxor the other ones

Like in spreadsheet app columns, when we go above 63, we just add a new character, a new "digit" in this mixed-radix representation

we encode the most significant "digit" first, so the output is "stable" (ab,ac instead of ba,ca), i.e. its changes from the end, preserving a shared prefix accross iterations and visual symetry

## areuniq calculation

so how is the uniqueness check actually performed

the rules are:

- we have N integers
- we want zero if they are all different from each other, and non-zero otherwise

computation:

- take all unsorted pairs of values
- you'll have the binomial coefficient: $\binom{N}{2}$ pairs
- compute the difference between each: a-b, a-b, b-c...
- multiply all the differences together

if two values are equal to each other, the difference will be zero, thus the whole product will be zero.

this is called the Vandermonde determinant, and code for it can be easily generated.

## the problem

$\binom{N}{2}$ scales quadratically. As N grows, we reach thousands, millions of pairs. This is obviously not acceptable, as file size explodes, and it could slow down significantly or even break compilation.

Therefore, I've been looking for ways to express `areuniqN` in the fewest possible amount of bytes. I've considered the following

- linear simplification using static syntax helpers (express a subtraction in 5 tokes instead of 7 by calling this macro): too insiginificant, doesn't fix the quadratic binomial growth problem
- recursive helpers: we can expand helpers in powers of 2: `#define _2(a,b) ((a)-(b))`, `#define _4(a,b,c,d) _2(a,b)*_2(c,d)`. shorter to express long streches of subtractions, but it's the same problem as before: the number of pairs grows quadratically, therefore the savings offer diminishing returns as N grows. the problem isn't the syntax, it's the sheer number of terms.

which got me thinking. because `areuniqN` isn't an unstructured blob of random subtractions. it's the Vandermonde determinant. Which is, in fact, very structured.

Which... could mean that we could express it recursively.

## Triangles: Recursion and You and You and You and You and You

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

N can be expressed in terms of N-1 by just adding a row to the triangle

## Recursion sequence

base case is at $N=2$ (just one difference a-b)

Triangle method gives $\lceil\frac{N}{2}\rceil$ and $\lfloor\frac{N}{2}\rfloor$ recursion:

- depth: $\log_2N-1$.
- Max: $\log_2N-1 = 200 \Harr N = 2^{201}$.
- Not quadratic in terms of code size, but requires a lot of helpers for rects.

Row method gives $N-1$ recursion:

- $N-1$ depth.
- Max: $N-1 = 200 \Harr N = 201$.
- Fully linear, bounded set of helpers needed (alwas (<=64).1 cross differences)

201 is not enough, but we will never need anything even remotely close to $2^{201}$

actually i we could define a reasonable maximum at $N=10^6$

so we want $N=10^6$ to require 200 macro calls.

This means we have a "budget" of 200 recursive calls we need to exhaust.

log2(10^6) = 19.93.., almost 20

question: for each N, when to use row or triangle method so that the depth required to express N<=10^6 is always <= 200

then: check if continuous: does the required depth always grow with N? can we expect issues if we forget to account that

### idea 1: the logarithmic highway method

facts:

- our recursion limit is 200.
- triangle recursion should be as rare as possible in order to consume all our budget, since  they are longer to express and require more helpers.
- triangle recursion is more efficient at big N, (N/2, goes down faster), whereas row recursion is constant (always N-1)

## Triangle recursion method

General method to express vN:

we know vN is expressed by a triangle of height N-1

Split triangle in three parts

- bottom left rectangle of width floor(N/2) and height ceil(N/2)
- two smaller rectangle triangles:
  - of height N/2-1 if N is even
  - one of height floor((N-2)/2), one of height ceil((N-2)/2) if N is odd
- recursive calls:
  - $\lceil\frac{N}{2}\rceil$ and $\lfloor\frac{N}{2}\rfloor$

N=9

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

$a\le$

Split:

4*5

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

v4

```text
(a-b)
(a-c)(b-c)
(a-d)(b-d)(c-d)
```

v5

```text
(e-f)
(e-g)(f-g)
(e-h)(f-h)(g-h)
(e-i)(f-i)(g-i)(h-i)
(e-i)(f-i)(g-i)(h-i)
```

Height = N-1

N=10:

```text
(a-b)
(a-c)(b-c)
(a-d)(b-d)(c-d)
(a-e)(b-e)(c-e)(d-e)
(a-f)(b-f)(c-f)(d-f)(e-f)
(a-g)(b-g)(c-g)(d-g)(e-g)(f-g)
(a-h)(b-h)(c-h)(d-h)(e-h)(f-h)(g-h)
(a-i)(b-i)(c-i)(d-i)(e-i)(f-i)(g-i)(h-i)
(a-j)(b-j)(c-j)(d-j)(e-j)(f-j)(g-j)(h-j)(i-j)
```
