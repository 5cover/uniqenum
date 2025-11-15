# TODO

## Generator

- [ ] configure dirtree output shared prefix digits group size (default 2)
- [ ] configure assertion macro name
- [ ] provide hybrid assertion model
  - differences between assertion modes: once or all:
    1. in once, the base case `areuniq2` is a regular expression. in all, it is a static assertion.
    2. in once, `areuniq` sub-clique macro calls are separated by `*`. in all, they are separated by `;`.
    3. in once, `uniquenumN` statically asserts that `areuniqN` is non-zero. in all, this call is unnecessary; static assertions are already provided by the `areuniq2` base case
  - provide a code user config macro: `UNIQENUM_ASSERT_ALL_PAIRS`. when defined:
    - `_UNIQj` is `;`, otherwise `*`.
    - `areuniq2` static asserts, otherwise is an expression.
    - `uniqenumN` does not static assert, otherwise it does.
    - make vendor prefix `UNIQ` configurable in the apicligui
- [ ] test correctness of generation (currently the samples serve as a makeshift test suite to see if regenerating forms git diffs)
- [ ] tooling that refactors regular enums in a code base into uniqenums automatically. skips auto initializer only enums, and asks in the console for each enum about the unique patterns (full/partial uniqueness)

## API

What we want to be able to do

- Generate `areuniq` and/or `uniqenum`
- Generate for a single N or a range
- Output in stdout or file or directory with trie and capped file size
- Generate dependencies or omit
- Customize `areuniq` macro name
- Customize `uniqenum` macro name
- Customize assertion mode and msg
  - all: assert each pair
  - once: assert all pairs
- Customize include guard style (classic, pragmaOnce, omit)

## Cost analysis

helper: base-10 digit count:

$$
d(n)=\lceil\log_{10} n+1\rceil
$$

`ident` of $N-1$ \in \N \cup {0}$: (idents start at zero, $\sum$ at 1, so this allows us to simplify the log)

$$
c_\text{ident}(N) = \lceil\log_{63}\frac{31N}{26}\rceil
$$

`areuniq` of $2$ in *expression* (assert once all pairs) mode:

$$
c_{\text{areuniq}2} = 32
$$

- 8 for `#define` plus space
- 8 for the name `areuniq2`
- 5 for parameters `(a,b)`
- 10 for pair `((a)!=(b))`
- 1 for newline

`areuniq` of $N \in \N \cap [3,\infin]$ in *expression* mode:

$$
c_{\text{areuniq}N} = 43 + 3N + 3\sum_{n=1}^N c_\text{ident}(n) + 2d(\lceil\frac{2N}{3}\rceil) + d(\lfloor\frac{2N}{3}\rfloor+1) + d(N)
$$

Example

```c
#define areuniq10(a,b,c,d,e,f,g,h,i,j)areuniq7(a,b,c,d,e,f,g)*areuniq7(a,b,c,d,h,i,j)*areuniq6(e,f,g,h,i,j)
```

- 8 for `#define` plus space
- 1 for newline
- 28 for `areuniq`, four times
- 8 for parameter/argument list parens, four times
- 2 for multiplication start between the `areuniq` calls
- $3N-4$ for commas in the parameter and three argument lists
- $3\sum_{n=1}^N\lceil\log_{63}\frac{31n}{26}\rceil$ for parameters + arguments
- $2d(\lceil\frac{2N}{3}\rceil)$ for the two complete areuniq dependency name digit count
- $d(\lfloor\frac{2N}{3}\rfloor+1)$ for the one incomplete areuniq dependency name digit count
- $d(N)$ for the areuniq name digit count

`areuniq` of $2$ in *assertion* (assert all pairs) mode:

$$

$$

`areuniq` of $N \in \N \cap [3,\infin]$ in *assertion* mode:

`uniqenum` of $1$ in *expression* or *assertion* mode:

`uniqenum` of $N \in \N \cap [2,\infin]$ in *expression* mode:

`areuniq` of $N \in \N \cap [3,\infin]$ in *assertion* mode:
