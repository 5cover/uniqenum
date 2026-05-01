# Benchmarks

This folder holds benchmark utilities that are not part of the shipped package or test suite.

## Paper Results Table

Run:

```sh
pnpm exec tsx benchmarks/run.ts
```

The script writes `benchmarks/results.csv`, which maps directly to the evaluation table in `PAPER.MD`.

Columns:

- `range`: inclusive generated macro range, such as `2-256`.
- `fileBytes`: generated header size for that range.
- `maxMacroDepth`: recursive `areuniqN` depth for the largest `N` in the range.
- `compiler`: compiler version used for the row.
- `checkSeconds` and `checkStatus`: syntax-only time/status for GCC/Clang; compile-only object time/status for TCC because TCC does not provide a true `-fsyntax-only` mode.
- `fullSeconds` and `fullStatus`: complete compile/link time/status for a sample program, with output written to the platform null device.
- `notes`: benchmark mode details.

The generated sample program includes the header, defines a `uniqenumN` enum using distinct integer values, calls a function returning one enumerator, and provides `main`.

By default the script tests `2-64`, `2-128`, `2-256`, and `2-512` against every available compiler among `gcc`, `clang`, and `tcc`.

Custom ranges can be provided as space- or comma-separated `START-END` values:

```sh
pnpm exec tsx benchmarks/run.ts 2-64 2-128
pnpm exec tsx benchmarks/run.ts 2-64,2-128,2-256
```
