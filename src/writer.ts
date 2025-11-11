import { createWriteStream } from 'fs';
import { ensureDirSync } from 'fs-extra';
import type { CodeGenerator } from './CodeGenerator.js';
import { LengthWriter, StreamWriter, StringWriter, type Writer } from './writing.js';
import path from 'path';
import type { range } from './types.js';
import { intersectingRanges, R } from './util.js';
import { log } from 'console';

export interface FileWriterConfig {
    maxFileSize: number;
    outputDir: string;
    includeGuards: IncludeGuardStrategy;
    // maximum n. if end is not finite, the file writer writes headers until their size cannot accomdate maxFileSize bytes
    N: range;
}

type UC<S extends string> = Lowercase<S> | Uppercase<S>;
type Prefix = UC<'areuniq' | 'uniqenum'>;
type IncludeGuardStrategy = 'omit' | 'pragmaOnce' | 'classic';

interface IncludeGuard {
    start: (writer: Writer, prefix: Prefix, N: range) => Writer;
    end: string;
}

export class FilesWriter {
    /**
     * sorted array of N.start values of all aruniq headers written so far
     */
    private readonly areuniqFiles: number[] = [];
    private readonly inclGuard: IncludeGuard;
    constructor(
        private readonly cgen: CodeGenerator,
        private readonly cfg: Readonly<FileWriterConfig>
    ) {
        this.inclGuard = includeGuard(cfg.includeGuards);
    }

    readonly generate = () => {
        ensureDirSync(this.cfg.outputDir);

        const nEndAreuniq = writeFiles({
            N: this.cfg.N,
            path: N => path.resolve(this.cfg.outputDir, StringWriter.ret(sourceFilename, 'areuniq', N)),
            endN: this.areuniqNend,
            start: N => this.areuniqFiles.push(N.start),
            body: (w, N) => {
                this.inclGuard.start(w, 'AREUNIQ', N);
                this.includes(w, this.areuniqIncludes(N));
                let n = N.start;
                while (n <= N.end) {
                    this.logProgress('areuniq', this.cfg.N, n);
                    this.cgen.areuniq(w, n++);
                }
                return w.str(this.inclGuard.end);
            },
        });

        // write as many uniqenum as we've got of areuniq
        const uniqenumN = R(this.cfg.N.start, nEndAreuniq);
        writeFiles({
            N: uniqenumN,
            path: N => path.resolve(this.cfg.outputDir, StringWriter.ret(sourceFilename, 'uniqenum', N)),
            endN: this.uniqenumNend,
            body: (w, N) => {
                this.inclGuard.start(w, 'UNIQENUM', N);
                this.includes(w, this.uniqenumIncludes(N));
                let n = N.start;
                while (n <= N.end) {
                    this.logProgress('uniqenum', uniqenumN, n);
                    this.cgen.uniqenum(w, n++);
                }
                return w.str(this.inclGuard.end);
            },
        });
    };

    private readonly uniqenumNend = (nMaxPrevious: number): number | null => {
        const N = { start: nMaxPrevious + 1, end: nMaxPrevious + 1 };

        let macroSize = 0;
        const maxSize = this.cfg.maxFileSize;

        while (N.end <= this.cfg.N.end) {
            // Predict cost if we include nEnd
            const nextMacroSize = LengthWriter.ret(this.cgen.uniqenum, N.end);

            const predicted =
                this.inclGuard.end.length +
                LengthWriter.ret(this.inclGuard.start, 'UNIQENUM', N) +
                LengthWriter.ret(this.includes, this.uniqenumIncludes(N)) +
                macroSize +
                nextMacroSize;

            // If adding this macro would exceed limit
            if (predicted > maxSize) {
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
    private readonly areuniqNend = (nMaxPrevious: number): number | null => {
        // possible optimization: since size is monotonic, binary search. we know header macro count decreases as macro gets bigger and bigger, therefore the amount of macros in the new header will be smaller than the amount of macros in the previous header.
        const N = { start: nMaxPrevious + 1, end: nMaxPrevious + 1 };

        let macroSize = 0;
        const maxSize = this.cfg.maxFileSize;

        while (N.end <= this.cfg.N.end) {
            // Predict cost if we include nEnd
            const nextMacroSize = LengthWriter.ret(this.cgen.areuniq, N.end);

            const predicted =
                this.inclGuard.end.length +
                LengthWriter.ret(this.inclGuard.start, 'AREUNIQ', N) +
                LengthWriter.ret(this.includes, this.areuniqIncludes(N)) +
                macroSize +
                nextMacroSize;

            // If adding this macro would exceed limit
            if (predicted > maxSize) {
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
        return intersectingRanges(this.areuniqFiles, R(Math.floor((2 * N.start) / 3), Math.ceil((2 * N.end) / 3)));
    };

    private readonly uniqenumIncludes = (N: range) => {
        return intersectingRanges(this.areuniqFiles, N);
    };

    private readonly includes = (w: Writer, headersIndices: range) => {
        for (let i = headersIndices.start; i <= headersIndices.end; ++i) {
            w.str('#include "');
            sourceFilename(w, 'areuniq', R(this.areuniqFiles[i]!, this.areuniqFiles[i + 1]! - 1));
            w.str('"\n');
        }
        return w;
    };

    private readonly logProgress = (name: Prefix, N: range, n: number) => {
        const nEndFinite = isFinite(N.end);
        console.log(
            `Writing ${name}`,
            nEndFinite ? `${n}/${N.end}` : n,
            nEndFinite ? ((100 * (n - N.start)) / (N.end - N.start + 1)).toPrecision(3) + '%' : ''
        );
    };
}

interface WriteFilesSpec {
    N: range;
    path: (N: Readonly<range>) => string;
    endN: (previousEndN: number) => number | null;
    start?: (N: Readonly<range>) => void;
    body: (w: StreamWriter, N: Readonly<range>) => Writer;
}

function writeFiles(cfg: WriteFilesSpec) {
    let N: range = { start: cfg.N.start, end: cfg.N.start - 1 };
    while (N.start <= cfg.N.end) {
        const nEndOrNull = cfg.endN(N.end);
        if (nEndOrNull === null) {
            // if we have a reachable end, just write one macro, even if it overflow the size limit
            if (isFinite(cfg.N.end)) N.end = N.start;
            // otherwise, stop now
            else break;
        } else {
            N.end = nEndOrNull;
        }
        const w = new StreamWriter(createWriteStream(cfg.path(N)));
        cfg.body(w, N);
        cfg.start?.(N);
        w.end();
        N.start = N.end + 1;
    }
    return N.end;
}

function includeGuard(strat: IncludeGuardStrategy): IncludeGuard {
    switch (strat) {
        case 'classic':
            return {
                end: '#endif\n',
                start: (w, prefix, N) => {
                    const s = w.str('#ifndef ').save(sourceName, prefix, N);
                    return w.str('\n#define ').use(s).str('\n');
                },
            };
        case 'omit':
            return {
                start: w => w,
                end: '',
            };
        case 'pragmaOnce': {
            return {
                start: w => w.str('#pragma once\n'),
                end: '',
            };
        }
    }
}

function sourceFilename(w: Writer, prefix: Prefix, N: range) {
    return sourceName(w, prefix, N).str('.h');
}

function sourceName(w: Writer, prefix: Prefix, N: range) {
    return w.str(prefix).int(N.start).str('_').int(N.end);
}
