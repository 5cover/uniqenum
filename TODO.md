# TODO

## Generator

- Reimplement the whole thing in Node TypeScript
- use modern conventions and a focused CLI and API for generating the code
- provide downloadable pre-generated files in the repo.
- avoid scope creep: no generator abstraction yet, keep MVP: focus on the actual generation logic for now instead of everything around it.

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
