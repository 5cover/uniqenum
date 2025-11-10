import fs from 'fs-extra';
import type { UniqenumSpec } from './types.js';
import type { CodeGenerator } from './CodeGenerator.js';
import { logWriter, measureLength, streamWriter, writeStream } from './writing.js';
import path from 'path';
/*
Writer -- output strategy of the generation algorithm
2 kinds out output: uniqenum and shared helpers
StreamWriter -> write all to a stram, helpers first
FilesWriter -> write all to files, with optional binning of uniqenum files capping file size
*/

export interface CodeWriter {
    generateAreuniq(n: number, code: string): void;
}

export class StreamWriter implements CodeWriter {
    constructor(
        private readonly stream: NodeJS.WritableStream,
        private readonly spec: UniqenumSpec,
        private readonly cgen: CodeGenerator
    ) {}
    generateAreuniq() {
        const w = logWriter;
        for (let n = this.spec.N.start; n <= this.spec.N.end; ++n) {
            this.cgen.areuniq(n)(w);
        }
    }
    writeUniquenum(n: number, code: string): void {
        this.stream.write(code);
    }
}

type FileInfo = [startN: number, code: string];

export interface FileWriterConfig {
    maxFileSize: number;
    outputDir: string;
    includeGuards: IncludeGuardStrategy;
}

type IncludeGuardStrategy = 'omit' | 'pragmaOnce' | 'classic';

interface IncludeGuard {
    start: string;
    end: string;
}

export class FileWriter {
    // files Nmin values, except the first file's, which is assumed to be spec.N.start. successive elements represent bins in files
    // stays sorted
    private filesAreuniq: number[] = [];
    constructor(
        private readonly cfg: Readonly<FileWriterConfig>,
        private readonly spec: UniqenumSpec,
        private readonly cgen: CodeGenerator
    ) {}

    generateAreuniq() {
        fs.ensureDirSync(this.cfg.outputDir);
        let n = this.spec.N.start;
        let nEnd = n - 1;
        while (n <= this.spec.N.end) {
            nEnd = this.headerEndNareuniq(n, nEnd);
            const inclGuard = this.getIncludeGuard('AREUNIQ', n, nEnd);
            writeStream(
                fs.createWriteStream(path.resolve(this.cfg.outputDir, sourceFilename('areuniq', n, nEnd))),
                w => {
                    w(inclGuard.start);
                    w(this.includes(n, nEnd));
                    this.filesAreuniq.push(n);
                    while (n++ <= nEnd) {
                        this.cgen.areuniq(n)(w);
                    }
                    w(inclGuard.end);
                }
            );
        }
    }

    private areuniqSize(deps: Set<string>, n: number) {
        return (
            this.areuniqAddDep(deps, Math.floor((2 * n) / 3)) +
            this.areuniqAddDep(deps, Math.ceil((2 * n) / 3)) +
            measureLength(this.cgen.areuniq(n))
        );
    }

    /**
     * Supposing a file contains macros for areuniq from to nStart..nEnd incl, build the code containing the required includes to previous headers
     */
    private areuniqAddDep(deps: Set<string>, depN: number) {
        const f = this.areuniqFilename(depN);
        if (deps.has(f)) return 0;
        deps.add(f);
        return f.length;
    }

    /**
     * Get  the name of the header that contains areuniqN
     */
    private areuniqFilename(n: number) {
        let i = 0;
        // example [100,200,300]
        // 134 -> 1
        // 70 -> 0..
        for (; this.filesAreuniq[i]! > n && i < this.filesAreuniq.length; ++i) {}
        return sourceFilename(
            'areuniq',
            this.filesAreuniq[i - 1] ?? this.spec.N.start,
            (this.filesAreuniq[i] ?? this.spec.N.end + 1) - 1
        );
    }

    private headerEndNareuniq(nMinPrevious: number, nMaxPrevious: number) {
        const nStart = nMaxPrevious + 1;
        // inc upper bound
        let nEnd = nStart;
        // we know header macro count decreases as macro gets bigger and bigger, therefore the amount of macros in the new header will be smaller than the amount of macros in the previous header.
        /*    hi = nMinPrevious + nMaxPrevious;

        // Binary search between lo and hi
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            const sum = this.headerSize(nMinPrevious, mid); // cumulative from nMin→mid
            if (sum <= limit) lo = mid;d
            else hi = mid - 1;
        }*/

        let size = 0;
        let macroSize = 0;
        do {
            nEnd++;
            macroSize += this.cgen.areuniqSize(nEnd);
            size =
                includeGuardSize(this.getIncludeGuard('AREUNIQ', nStart, nEnd)) +
                this.includes(nStart, nEnd).length +
                macroSize;
        } while (nEnd < this.spec.N.end && size <= this.cfg.maxFileSize);

        return nEnd; // N_max
    }

    private includes(nStart: number, nEnd: number): string {
        const nDepStart = Math.floor((2 * nStart) / 3);
        const nDepEnd = Math.ceil((2 * nEnd) / 3);
        const s = (nStart: number, nStartNext?: number | null) =>
            include(sourceFilename('areuniq', nStart, (nStartNext ?? this.spec.N.end + 1) - 1));
        // how many files  is nDepStart..nDepEnd spread across?
        let includes = '';
        let prevStart = this.spec.N.start;
        let i = 0;
        while (this.filesAreuniq[i]! < nDepStart) ++i;
        for (; i < this.filesAreuniq.length && this.filesAreuniq[i]! < nDepEnd; ++i) {
            const nStart = this.filesAreuniq[i]!;
            includes += s(prevStart, nStart);
            prevStart = nStart;
        }
        return includes;
    }

    private getIncludeGuard(prefix: 'AREUNIQ' | 'UNIQENUM', nStart: number, nEnd: number): IncludeGuard {
        switch (this.cfg.includeGuards) {
            case 'classic':
                const guardName = sourceName(prefix, nStart, nEnd);
                return {
                    end: '#endif',
                    start: `#ifndef ${guardName}\n#define ${guardName}\n`,
                };
            case 'omit':
                return {
                    start: '',
                    end: '',
                };
            case 'pragmaOnce': {
                return {
                    start: '#pragma once\n',
                    end: '',
                };
            }
        }
    }
}

function sourceFilename(prefix: string, nStart: number, nEnd: number) {
    return `${sourceName(prefix, nStart, nEnd)}.h`;
}

function sourceName(prefix: string, nStart: number, nEnd: number) {
    return `${prefix}${nStart}_${nEnd}`;
}

function includeGuardSize(guard: IncludeGuard) {
    return guard.end.length + guard.start.length;
}

function include(name: string) {
    return `#include"${name}"\n`;
}
