# Benchmarks

This folder holds benchmark utilities that are not part of the shipped package or test suite.

## Structural Metrics Table

The script `generateStructuralTable.ts` produces `benchmarks/structural-table.csv` with the columns:
`N, areuniqSize, uniqenumSize, areuniqDepth, effectiveComparisons, minComparisons`.

Run with the default N set:

```sh
npx tsx benchmarks/generateStructuralTable.ts
```

Or provide your own list (comma‑ or space‑separated):

```sh
npx tsx benchmarks/generateStructuralTable.ts 2 3 5 8 13
npx tsx benchmarks/generateStructuralTable.ts 4,8,16,32
```

The script reuses the generator API (`src/index.ts` / `CCodeGenerator`) so measurements always reflect current generator behavior. Output is deterministic and overwrites the existing CSV in place.
