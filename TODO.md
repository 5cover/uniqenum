# TODO

## Generator

- [x] Reimplement the whole thing in Node TypeScript
- [x] use modern conventions and a focused CLI and API for generating the code
- [x] optimize performance (currently v8 crashes for N too big, fearing oom), allow splitting output in files of defined size or inline generation, better
  - [ ] new cli: keep seq-like N, provide options:
  - [ ] `-s,--split <file-size>`: enable generation of split files. specify a max file size. generates split headers by grouping dependencies, only one include per header to form a tree sharing common $\lceil2N/3\rceil$ dependencies, minimizing preprocessor overhead
  - [ ] `-o,--output <path>`: define output dir/file. if absent, outputs to stdout. if splitting, treated as a directory, and files are created inside of it. if not splitting but path already exists as a directory, a single split file is created inside of it (cp-like behavior)
  - [ ] `--only`: skips checking for missing dependencies not covered by the requested N range (we'll have to implement that. basically if someone asks for N=100, clique method requires areuniq67 -- should it be implemented?)
    - without --only: implement all dependencies (recursively) using the most efficient method available, as normal
    - with --only: do not implement dependencies, but pretend they are here
- validate idents?
- [ ] API with more options than the CLI (cli doesn't provide string formatting option, it keeps the defaults)
  - split
  - output
  - name.areuniq(n) -> ident name for the `areuniq` macro
  - name.uniqenum(n) -> ident name for the `uniqenum` macro
  - uniqAssertionMsg(n) -> code for a C string literal for the static assertion message in `uniqenum`. not a string, because the user may want to concat enum name, type, keys and values. maybe we provide them an object to get access to the underlying ident parameters easily
- [ ] provide downloadable pre-generated files in the repo. thinking about a way to provide self contained headers
- [ ] tooling that refactors regular enums in a code base into uniqenums automatically. skips auto initializer only enums, and asks in the console for each enum about the unique patterns (full/partial uniqueness)

```text
/**
  * include: include dependencies, even if not in original N range
  * exclude: exclude dependencies
  */
deps: 'include' | 'exclude';
```

## Paper

Rewrite scraps into an actual engineering paper covering

That outline is actually solid — coherent, scoped, and clearly yours. You’ve turned a pile of notes and algebra into an organized *engineering narrative*, which is exactly what a paper should be.

A paper in this context doesn’t have to be academic in the “LaTeX-and-citations” sense. Think of it as an **engineer’s long-form design document**: written for someone clever but not psychic, who wants to understand how you solved a technical problem and what trade-offs you made.

Here’s how to expand your outline into a working structure without drowning in formality:

### 1. Abstract

A single paragraph that states the problem and your contribution:

> This paper presents `uniqenum`, a family of C macros that generate compile-time verified enumerations, guaranteeing value uniqueness through an algebraic identity derived from the Vandermonde determinant. The method balances static safety with preprocessor limits by using recursive tiling and file segmentation strategies.

### 2. Introduction

Tell the story: why duplicate enum values matter, why it’s easy to miss, and how the C preprocessor is both your curse and your playground.
Set tone and motivation; one page is enough.

### 3. Problem Definition

Formalize what “unique enum” means:

- Enumerations as compile-time mappings.
- Duplicate value hazards (static initialization bugs, unreachable cases, etc.).
- Compiler limits: macro depth, file size, token count.

You can show a concrete “bug before” snippet here.

### 4. Theoretical Foundation

This is where your **scraps/math.md** becomes structured prose:

- Explain the Vandermonde determinant: ( \prod_{i<j}(a_i - a_j) ).
- Show why non-zero ⇒ uniqueness.
- Translate that into macro-expressible arithmetic.
- Introduce your **triangle representation** and **row vs. triangle recursion** metaphors.
- Include diagrams (ASCII or rendered later in Markdown).

### 5. Design and Implementation

Now, the practical engineering:

- The macro family structure (`uniqenumN`, helpers like `x_W_H`).
- The recursion limits and tiling strategies.
- File segmentation and binning.
- Configurable constraints.
- The “Highway” abstraction — how you model depth minimization.

This is the beating heart: annotated code, reasoning, complexity analysis.

### 6. Optimization and Trade-offs

Describe the levers:

- Why triangle recursion outperforms naïve expansion.
- Code size vs. macro depth trade-off.
- Human readability vs. generation compactness.
- Deterministici minimal identifier generation (`ident()` function)
- Preprocessor quirks exploited (folding, line continuations, token pasting).

### 7. Tooling and Usage

Here you present the Node generator:

- How to install (`npm i -g uniqenum`).
- How to run (`uniqenum --N 128 > uniqenum128.h`).
- Example generated header snippets.
- Optional: integration with build systems.

### 8. Evaluation

A table of tested Ns, compile times, file sizes, macro depths.
Note where it fails gracefully. Include sample compiler output when assertions catch duplicates.

### 9. Discussion / Future Work

- Extending to other macro “families” (`maxN`, etc.).
- Possible automation of the paving algorithm.
- Open questions about theoretical limits (can the determinant representation scale infinitely?).

### 10. Conclusion

Wrap it cleanly:

> `uniqenum` demonstrates that algebraic reasoning can guide preprocessor metaprogramming. Within the rigid constraints of the C macro system, the Vandermonde determinant offers both mathematical rigor and an oddly beautiful safety guarantee.

### 11. Appendix

- Example code listings.
- References to compiler manuals or preprocessor standards if you want a thin scholarly varnish.

Keep the tone technical but human. Your outline already has all the ingredients; just stretch each bullet into an argument, and let the math speak. You’re not writing for citation metrics — you’re documenting a strange, elegant idea well enough that another engineer could follow the path without losing their mind.

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
