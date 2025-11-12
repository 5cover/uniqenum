import { closeSync, openSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import type { CodeGenerator } from './CodeGenerator.js';
import { LengthWriter, FdWriter, StringWriter, type Writer, type Teller } from './writing.js';
import path from 'path';
import type { range } from './types.js';
import { intersectingRanges, R } from './util.js';
import { toBase63 } from './ident.js';

export interface FileWriterConfig {
    maxFileSize: number;
    outputDir: string;
    includeGuards: IncludeGuardStrategy;
    /** maximum n. if end is not finite, the file writer writes headers until their size cannot accomdate maxFileSize bytes */
    N: range;
}

type Prefix = 'areuniq' | 'uniqenum';
type IncludeGuardStrategy = 'omit' | 'pragmaOnce' | 'classic';

interface IncludeGuard {
    start: (writer: Writer, fileNo: number) => Writer;
    end: string;
}

export class FilesWriter {
    /**
     * sorted array of N.start values of all aruniq headers written so far
     */
    private readonly areuniqFiles: number[] = [];
    private fileNo = 0;
    private readonly inclGuard: IncludeGuard;
    constructor(
        private readonly cgen: CodeGenerator,
        private readonly cfg: Readonly<FileWriterConfig>
    ) {
        this.inclGuard = includeGuard(cfg.includeGuards);
    }

    readonly generate = () => {
        this.fileNo = 0;

        const nEndAreuniq = this.writeFiles({
            prefix: 'areuniq',
            N: this.cfg.N,
            endN: this.areuniqNend,
            includes: N => {
                this.areuniqFiles.push(N.start);
                return this.areuniqIncludes(N);
            },
            macroBody: this.cgen.areuniq,
        });

        this.writeFiles({
            prefix: 'uniqenum',
            N: R(this.cfg.N.start, nEndAreuniq), // write as many uniqenum as we've got of areuniq
            endN: this.uniqenumNend,
            includes: this.uniqenumIncludes,
            macroBody: this.cgen.uniqenum,
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
                LengthWriter.ret(this.inclGuard.start, this.fileNo) +
                LengthWriter.ret(this.includes, this.dirof('areuniq', N), this.uniqenumIncludes(N)) +
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
                LengthWriter.ret(this.inclGuard.start, this.fileNo) +
                LengthWriter.ret(this.includes, this.dirof('areuniq', N), this.areuniqIncludes(N)) +
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

    private readonly includes = (w: Writer, currentDir: string, headersIndices: Readonly<range>) => {
        for (let i = headersIndices.start; i <= headersIndices.end; ++i) {
            w.str('#include "');
            let N = R(this.areuniqFiles[i]!, this.areuniqFiles[i + 1]! - 1);
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

    private readonly logProgress = (name: Prefix, N: Readonly<range>, n: number) => {
        const nEndFinite = isFinite(N.end);
        console.log(
            `Writing ${name}`,
            nEndFinite ? `${n}/${N.end}` : n,
            nEndFinite ? ((100 * (n - N.start)) / (N.end - N.start + 1)).toPrecision(3) + '%' : ''
        );
    };

    private readonly dirof = (prefix: Prefix, N: range) => {
        let commonPrefix: string;
        if (N.start === N.end) {
            commonPrefix = N.start.toString();
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
        for (let j = 1; j < commonPrefix.length; j += 2) {
            dirs.push(commonPrefix.slice(j - 1, j + 1));
        }

        return path.resolve(this.cfg.outputDir, prefix, ...dirs);
    };

    readonly ensuredDirs = new Set<string>();
    private readonly writeFiles = (cfg: Readonly<WriteFilesSpec>) => {
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
            const currentDir = this.dirof(cfg.prefix, N);
            if (!this.ensuredDirs.has(currentDir)) {
                this.ensuredDirs.add(currentDir);
                ensureDirSync(currentDir);
            }
            const fd = openSync(path.resolve(currentDir, StringWriter.ret(sourceFilename, cfg.prefix, N)), 'w');
            try {
                const w = new FdWriter(fd);
                this.inclGuard.start(w, this.fileNo++);
                this.includes(w, currentDir, cfg.includes(N));
                let n = N.start;
                while (n <= N.end) {
                    this.logProgress(cfg.prefix, cfg.N, n);
                    cfg.macroBody(w, n++);
                }
                w.str(this.inclGuard.end);
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
    endN: (previousEndN: number) => number | null;
    prefix: Prefix;
    macroBody: Teller<[number]>;
    includes: (N: Readonly<range>) => Readonly<range>;
}

function includeGuard(strat: IncludeGuardStrategy): IncludeGuard {
    switch (strat) {
        case 'classic':
            return {
                end: '#endif\n',
                start: (w, fileNo) => {
                    const guardMacro = `UNIQ${toBase63(fileNo)}_H\n`;
                    return w.str('#ifndef ').str(guardMacro).str('#define ').str(guardMacro);
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
    w.str(prefix).int(N.start);
    if (N.end !== N.start) w.str('-').int(N.end);
    return w.str('.h');
}
