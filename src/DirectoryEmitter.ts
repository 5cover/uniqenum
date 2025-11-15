import { closeSync, openSync, mkdirSync } from 'fs';
import { LengthWriter, FdWriter, StringWriter, type Writer, type Teller } from './writing.js';
import path from 'path';
import type { CodeGenerator, EmitConfig, EmitFn, GenerationSummary, MacroFamily, range } from './types.js';
import { intersectingRanges, R } from './util.js';
import { toBase63 } from './ident.js';

export interface DirectoryEmitterConfig {
    path: string;
    prefixSubdirectoryLength: number;
}

export const emitDirectory: EmitFn<DirectoryEmitterConfig> = (cgen, cfg, dir) =>
    new DirectoryEmitter(cgen, cfg).generate(dir);
class DirectoryEmitter {
    /**
     * Sorted array of lower bounds for written areuniq headers.
     * The last value is a singleton range
     */
    private readonly areuniqFiles: number[] = [];
    private fileNo = 0;
    private dir!: DirectoryEmitterConfig;
    constructor(
        private readonly cgen: CodeGenerator,
        private readonly cfg: EmitConfig
    ) {}

    readonly generate = (dir: DirectoryEmitterConfig): GenerationSummary => {
        this.fileNo = 0;
        this.areuniqFiles.length = 0;
        this.mkDired.clear();
        this.dir = dir;

        const areuniq: range = R(
            this.cfg.N.start,
            this.cfg.macros.areuniq
                ? this.writeFiles({
                      family: 'areuniq',
                      N: this.cfg.N,
                      endN: this.areuniqNend,
                      includes: N => {
                          this.areuniqFiles.push(N.start);
                          return this.areuniqIncludes(N);
                      },
                      macroBody: this.cgen.areuniq,
                  })
                : this.cfg.N.start - 1
        );
        this.areuniqFiles.push(areuniq.end + 1); // last exclusive bound (areuniqFile's last element represents a singleton range)

        const uniqenum = R(
            this.cfg.N.start,
            this.cfg.macros.uniqenum
                ? this.writeFiles({
                      family: 'uniqenum',
                      N: areuniq,
                      endN: this.uniqenumNend,
                      includes: this.uniqenumIncludes,
                      macroBody: this.cgen.uniqenum,
                  })
                : this.cfg.N.start - 1
        );

        return { areuniq, uniqenum };
    };

    private readonly uniqenumNend = (baseSize: number, nMaxPrevious: number): number | null => {
        const N = { start: nMaxPrevious + 1, end: nMaxPrevious + 1 };

        let macroSize = 0;
        const constSize = this.cfg.includeGuard.end.length + baseSize;

        while (N.end <= this.cfg.N.end) {
            // Predict cost if we include nEnd
            const nextMacroSize = LengthWriter.ret(this.cgen.uniqenum, N.end);

            const predicted =
                constSize +
                LengthWriter.ret(this.cfg.includeGuard.start, toBase63(this.fileNo)) +
                LengthWriter.ret(this.includes, this.dirof('areuniq', N), this.uniqenumIncludes(N)) +
                macroSize +
                nextMacroSize;

            // If adding this macro would exceed limit
            if (predicted > this.cfg.maxSize) {
                // but we haven't added anything yet, so we grew out of our limit
                if (N.end === N.start) return null;
                break;
            }

            // Commit
            macroSize += nextMacroSize;
            N.end++;
        }

        // Return the last successfully included index
        return N.end - 1;
    };

    /**
     * Returns the nEnd, largest upper N bound of the next header while keeping header size under or equal to the limit. Returns null if writing 1 macro would already blow past the size limit.
     */
    private readonly areuniqNend = (baseSize: number, nMaxPrevious: number): number | null => {
        // possible optimization: since size is monotonic, binary search. we know header macro count decreases as macro gets bigger and bigger, therefore the amount of macros in the new header will be smaller than the amount of macros in the previous header.
        const N = { start: nMaxPrevious + 1, end: nMaxPrevious + 1 };

        const constSize = baseSize + this.cfg.includeGuard.end.length;
        let macroSize = 0;

        while (N.end <= this.cfg.N.end) {
            // Predict cost if we include nEnd
            const nextMacroSize = LengthWriter.ret(this.cgen.areuniq, N.end);

            const predicted =
                constSize +
                LengthWriter.ret(this.cfg.includeGuard.start, toBase63(this.fileNo)) +
                LengthWriter.ret(this.includes, this.dirof('areuniq', N), this.areuniqIncludes(N)) +
                macroSize +
                nextMacroSize;

            // If adding this macro would exceed limit
            if (predicted > this.cfg.maxSize) {
                // but we haven't added anything yet, so we grew out of our limit
                if (N.end === N.start) return null;
                break;
            }

            // Commit
            macroSize += nextMacroSize;
            N.end++;
        }

        // Return the last successfully included index
        return N.end - 1;
    };

    private readonly areuniqIncludes = (N: range) => {
        return intersectingRanges(
            this.areuniqFiles,
            R(
                Math.max(this.cgen.bases.areuniq, Math.floor((2 * N.start) / 3)),
                Math.max(this.cgen.bases.areuniq, Math.ceil((2 * N.end) / 3))
            )
        );
    };

    private readonly uniqenumIncludes = (N: range) => {
        return intersectingRanges(this.areuniqFiles, N);
    };

    private readonly includes = (w: Writer, currentDir: string, headersIndices: Readonly<range>) => {
        for (let i = headersIndices.start; i <= headersIndices.end; ++i) {
            w.str('#include "');
            let N = R(
                this.areuniqFiles[i]!,
                i + 1 >= this.areuniqFiles.length ? this.areuniqFiles[i]! : this.areuniqFiles[i + 1]! - 1
            );
            w.str(
                path
                    .join(
                        path.relative(currentDir, this.dirof('areuniq', N)),
                        StringWriter.ret(sourceFilename, 'areuniq', N)
                    )
                    .replaceAll(/\\/g, '/') // keep cross platform path separators
            );
            w.str('"\n');
        }
        return w;
    };

    private readonly logProgress = (name: MacroFamily, N: Readonly<range>, n: number) => {
        const nEndFinite = Number.isFinite(N.end);
        console.log(
            `Writing ${name}`,
            nEndFinite ? `${n}/${N.end}` : n,
            nEndFinite ? ((100 * (n - N.start)) / (N.end - N.start + 1)).toPrecision(3) + '%' : ''
        );
    };

    private readonly dirof = (family: MacroFamily, N: range) => {
        let commonPrefix: string;
        if (N.start === N.end) {
            // make sure we cover at most n-1 digits
            // this avoids producing directories that can only contain a single file
            commonPrefix = N.start.toString().slice(0, -1);
        } else {
            const sStart = N.start.toString();
            const sEnd = N.end.toString();

            // find common prefix digits
            let i = 0;
            while (i < sStart.length && sStart[i] === sEnd[i]) i++;

            commonPrefix = sStart.slice(0, i);
        }

        const dirs = [];
        // split prefix into 2-digit groups
        for (
            let j = 0;
            j < commonPrefix.length - (commonPrefix.length % this.dir.prefixSubdirectoryLength);
            j += this.dir.prefixSubdirectoryLength
        ) {
            dirs.push(commonPrefix.slice(j, j + this.dir.prefixSubdirectoryLength));
        }

        return path.resolve(this.dir.path, family, ...dirs);
    };

    readonly mkDired = new Set<string>();
    private readonly writeFiles = (cfg: Readonly<WriteFilesSpec>) => {
        let N: range = { start: cfg.N.start, end: cfg.N.start - 1 };
        const header = this.cgen.headers[cfg.family];
        while (N.start <= cfg.N.end) {
            const nEndOrNull = cfg.endN(+(N.start === cfg.N.start) * header.length, N.end);
            if (nEndOrNull === null) {
                // if we have a reachable end, just write one macro, even if it overflows the size limit
                if (Number.isFinite(cfg.N.end)) N.end = N.start;
                // otherwise, stop now
                else break;
            } else {
                N.end = nEndOrNull;
            }
            const currentDir = this.dirof(cfg.family, N);
            if (!this.mkDired.has(currentDir)) {
                this.mkDired.add(currentDir);
                mkdirSync(currentDir, { recursive: true });
            }
            const fd = openSync(path.resolve(currentDir, StringWriter.ret(sourceFilename, cfg.family, N)), 'w');
            try {
                const w = new FdWriter(fd);
                this.cfg.includeGuard.start(w, toBase63(this.fileNo++));
                if (N.start === cfg.N.start) w.str(header);
                else this.includes(w, currentDir, cfg.includes(N));
                let n = N.start;
                while (n <= N.end) {
                    this.logProgress(cfg.family, cfg.N, n);
                    cfg.macroBody(w, n++);
                }
                w.str(this.cfg.includeGuard.end);
                w.flush();
            } finally {
                closeSync(fd);
            }
            N.start = N.end + 1;
        }
        return N.end;
    };
}

interface WriteFilesSpec {
    N: range;
    endN: (baseSize: number, previousEndN: number) => number | null;
    family: MacroFamily;
    macroBody: Teller<[number]>;
    includes: (N: Readonly<range>) => Readonly<range>;
}

function sourceFilename(w: Writer, family: MacroFamily, N: range) {
    w.str(family).int(N.start);
    if (N.end !== N.start) w.str('-').int(N.end);
    return w.str('.h');
}
