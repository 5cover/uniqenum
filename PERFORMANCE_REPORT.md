# Uniqenum Performance Findings

## Baseline

- Command: `npx tsx -e "import { generate } from './src/index.ts'; console.time('flat-200'); generate({ range: { start: 1, end: 200 }, output: { kind: 'file', path: 'out/tmp-flat.h', includeGuards: 'omit', maxBytes: 1e9 } }); console.timeEnd('flat-200');"`
- Result: `flat-200: 1.064s`
- Context: The run only emits 200 `areuniq/uniqenum` pairs. This is noticeably slower than the ad-hoc scripts we used before introducing the CLI because each macro is now materialized several times per `n`.

## Findings & Recommendations

### 1. Flat output emits every macro twice

- Evidence: `emitSoloFamily` and `emitPairedFamilies` call `LengthWriter.ret` and then call the same emitter again to write to the `Writer` (`src/index.ts:241-310`). That means each macro is fully generated at least twice; `areuniq(n >= 3)` can be generated up to three times because of its internal heuristics (see finding #2).
- Impact: For the `flat-200` run above the code spent ~1 s simply because the pipeline generates and formats ~400 macros instead of ~200. The extra work grows proportionally with the requested range and makes the CLI feel 2‑3× slower than the earlier bare generator.
- Suggested improvements:
  1. Use a single pass per `n`: render into a `StringWriter` (or `Writer.save`) once, measure `chunk.length`, check the size limit, then reuse the buffered chunk for the actual output.
  2. Alternatively, extend `Writer` with a “tee” implementation that counts characters while forwarding directly to the target stream so no buffering is needed.
  3. Cache macro lengths per `n` (e.g. `Map<number, number>`) so directory and flat writers can reuse them without rerunning the code generator.

### 2. `areuniq` heuristics triple the work for small `n`

- Evidence: To decide between the clique-based and expanded forms, `areuniq` always evaluates both with `LengthWriter.ret` (`src/CodeGenerator.ts:66-88`). When the CLI asks for the macro length (Finding #1), it triggers both calculations; the subsequent real emission re-runs the same comparison unless the `pivotNcliqueSmaller` was updated in the probe.
- Impact: For every `n` below the pivot (typically dozens of values) the project currently runs up to three full graph traversals and formatting passes. This explains the “slow macro” feeling compared to the old test harness which skipped the outer length probe.
- Suggested improvements:
  1. Cache the winning macro body per `n` (or at least cache the measured lengths) so the second caller can reuse the decision without recomputing.
  2. Replace the eager `LengthWriter` calls with a cheaper heuristic: estimate clique vs. expanded cost analytically (closed-form formula) and fall back to actual generation only once around the estimated pivot.
  3. Expose an option to skip the size-based strategy when no `maxBytes` constraint is provided—the main motivation for the extra work disappears when everything goes to stdout or a single large file.

### 3. Directory packing recomputes static include prologues for every candidate

- Evidence: `uniqenumNend`/`areuniqNend` repeatedly call `LengthWriter.ret(this.inclGuard.start, ...)` and `LengthWriter.ret(this.includes, …)` inside their inner loops even though the include guard and include list do not change while `N.end` grows (`src/writer.ts:86-143`). Every attempted increment rebuilds the include list with `path.relative` + `StringWriter` even when the header selection fails.
- Impact: Packing a single header requires O(k²) path joins where k is the number of candidate macros tested. For large `maxFileSize` values this dominates runtime and garbage, especially because `includes` walks `areuniqFiles` ranges for every iteration.
- Suggested improvements:
  1. Precompute the serialized include guard prefix once per file number and reuse its length instead of recomputing it in the loop.
  2. Cache the include-list size for each `(prefix, directory, range)` triple because it only depends on the file currently being written.
  3. Convert the “grow until overflow” loops to binary search: size is monotonic, so we can probe logarithmically instead of linearly increasing `N.end`.

### 4. Directory generation logs every macro to the console

- Evidence: `logProgress` is invoked for each `n` inside `writeFiles`, and it performs a `console.log` with percentage math every time (`src/writer.ts:200-214`, `src/writer.ts:254-263`).
- Impact: Console I/O is synchronous on Windows and quickly becomes the dominant cost when generating thousands of macros (tens of thousands of logs). This did not exist in the ad-hoc scripts, hence the perceived slowdown “when using the new CLI/API.”
- Suggested improvements:
  1. Emit progress updates only every N macros or every 100 ms.
  2. Gate progress logging behind an option so CI/batch runs stay quiet.
  3. When logging, precompute invariant strings (range labels, totals) once per file instead of per macro.

## Next Steps

1. Decide which of the above optimizations should block the next release.
2. Implement the single-pass emission for flat outputs first—it gives an immediate ~2× win.
3. Then address the `areuniq` heuristic cache and directory packing loops; both materially affect large ranges.
4. Rerun the `flat-200` benchmark (and a higher range, e.g. 1–1000) after each fix to quantify the improvements.
