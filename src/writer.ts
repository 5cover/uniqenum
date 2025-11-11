import { createWriteStream } from 'fs';
import { ensureDirSync } from 'fs-extra';
import type { UniqenumSpec } from './types.js';
import type { CodeGenerator } from './CodeGenerator.js';
import { streamWriter, writeStream } from './writing.js';
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
        const w = streamWriter(this.stream);
        for (let n = this.spec.N.start; n <= this.spec.N.end; ++n) {
            this.cgen.areuniq(n)(w);
        }
    }
    writeUniquenum(n: number, code: string): void {
        this.stream.write(code);
    }
}

export interface FileWriterConfig {
    maxFileSize: number;
    outputDir: string;
    includeGuards: IncludeGuardStrategy;
}

type IncludeGuardStrategy = 'omit' | 'pragmaOnce' | 'classic';

interface IncludeGuard {
    prefix: string;
    suffix: string;
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
        ensureDirSync(this.cfg.outputDir);
        let n = this.spec.N.start;
        let nEnd = n - 1;
        while (n <= this.spec.N.end) {
            nEnd = this.headerEndNareuniq(n, nEnd);
            const inclGuard = this.getIncludeGuard('AREUNIQ', n, nEnd);
            writeStream(
                createWriteStream(path.resolve(this.cfg.outputDir, sourceFilename('areuniq', n, nEnd))),
                w => {
                    w(inclGuard.prefix);
                    w(this.includes(n, nEnd));
                    this.filesAreuniq.push(n);
                    while (n <= nEnd) {
                        console.log(n);
                        this.cgen.areuniq(n++)(w);
                    }
                    w(inclGuard.suffix);
                },
                { end: true }
            );
        }
    }
    // we know header macro count decreases as macro gets bigger and bigger, therefore the amount of macros in the new header will be smaller than the amount of macros in the previous header.
    /*    hi = nMinPrevious + nMaxPrevious;

        // Binary search between lo and hi
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            const sum = this.headerSize(nMinPrevious, mid); // cumulative from nMin→mid
            if (sum <= limit) lo = mid;d
            else hi = mid - 1;
        }*/
    private headerEndNareuniq(nMinPrevious: number, nMaxPrevious: number) {
        const nStart = nMaxPrevious + 1;
        let nEnd = nStart;

        let totalSize = 0;
        let macroSize = 0;
        const maxSize = this.cfg.maxFileSize;

        while (nEnd <= this.spec.N.end) {
            // Predict cost if we include nEnd
            const nextMacroSize = this.cgen.areuniqSize(nEnd);
            const guardCode = this.getIncludeGuard('AREUNIQ', nStart, nEnd);
            const includesCode = this.includes(nStart, nEnd);

            const predicted = includeGuardSize(guardCode) + includesCode.length + (macroSize + nextMacroSize);

            // If adding this macro would exceed limit
            if (predicted > maxSize) {
                // but we haven't added anything yet, force one element
                if (nEnd === nStart) return nStart;
                break;
            }

            // Commit
            macroSize += nextMacroSize;
            totalSize = predicted;
            nEnd++;
        }

        // Return the last successfully included index
        return nEnd - 1;
    }

    private includes(nStart: number, nEnd: number): string {
        if (this.filesAreuniq.length === 0) return '';

        // 1. Compute dependency range
        const depStart = Math.floor((2 * nStart) / 3);
        const depEnd = Math.ceil((2 * nEnd) / 3);

        // 2. Find first file that contains depStart
        let firstIdx = 0;
        while (firstIdx + 1 < this.filesAreuniq.length && this.filesAreuniq[firstIdx + 1]! <= depStart) {
            firstIdx++;
        }

        // 3. Find last file that contains depEnd
        let lastIdx = firstIdx;
        while (lastIdx + 1 < this.filesAreuniq.length && this.filesAreuniq[lastIdx + 1]! <= depEnd) {
            lastIdx++;
        }

        // 4. Build include directives for all those files
        let includes: string = '';
        for (let i = firstIdx; i <= lastIdx; i++) {
            const start = this.filesAreuniq[i]!;
            const end = (this.filesAreuniq[i + 1] ?? nStart) - 1; // last range extends up to us
            includes += '#include "';
            includes += sourceFilename('areuniq', start, end);
            includes += '"\n';
        }

        return includes;
    }

    private getIncludeGuard(prefix: 'AREUNIQ' | 'UNIQENUM', nStart: number, nEnd: number): IncludeGuard {
        switch (this.cfg.includeGuards) {
            case 'classic':
                const guardName = sourceName(prefix, nStart, nEnd);
                return {
                    suffix: '#endif\n',
                    prefix: `#ifndef ${guardName}\n#define ${guardName}\n`,
                };
            case 'omit':
                return {
                    prefix: '',
                    suffix: '',
                };
            case 'pragmaOnce': {
                return {
                    prefix: '#pragma once\n',
                    suffix: '',
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
    return guard.suffix.length + guard.prefix.length;
}

function include(name: string) {
    return `#include"${name}"\n`;
}
