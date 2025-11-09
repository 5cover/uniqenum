import fs from 'fs-extra';
import type { UniqenumSpec } from './types.js';
import type { CodeGenerator } from './CodeGenerator.js';
import * as g from './g.js';
import { lengthWriter, logWriter, measureLength, writeStream } from './writing.js';
import path from 'path';
/*
Writer -- output strategy of the generation algorithm
2 kinds out output: uniqenum and shared helpers
StreamWriter -> write all to a stram, helpers first
FilesWriter -> write all to files, with optional binning of uniqenum files capping file size
*/

export interface CodeWriter {
    writeAreuniq(n: number, code: string): void;
    writeUniquenum(n: number, code: string): void;
}

export class StreamWriter implements CodeWriter {
    constructor(private readonly stream: NodeJS.WritableStream) {}
    writeAreuniq(n: number, code: string): void {
        this.stream.write(code);
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
        let fileNStart = this.spec.N.start;
        let fileNEnd = this.spec.N.start;
        let fileIndex = 0;
        fs.ensureDirSync(this.cfg.outputDir);
        let n = this.spec.N.start;
        while (n <= this.spec.N.end) {
            const deps = new Set<string>();
            const name = path.resolve(this.cfg.outputDir, sourceFilename('areuniq', fileNStart, fileNEnd));
            const stream = fs.createWriteStream(name, { flush: true });

            const inclGuard = getIncludeGuard(this.cfg.includeGuards, 'AREUNIQ', fileIndex++);
            stream.write(inclGuard.start);

            let fileSize = inclGuard.start.length + inclGuard.end.length + this.areuniqSize(deps, n);
            do {
                logWriter(this.cgen.areuniq(n))
                /* writeStream(stream, this.cgen.areuniq(n)); */
                // each n depends on floor(2n/3) and ceil(2n/3)
                ++fileNEnd;
                ++n;
                fileSize += this.areuniqSize(deps, n);
            } while (n <= this.spec.N.end && fileSize <= this.cfg.maxFileSize);

            stream.write(inclGuard.end);
            /* stream.close(
                ((name, newName) => () => {
                    fs.rmSync(newName, { force: true });
                    fs.moveSync(name, newName);
                })(name, sourceFilename('areuniq', fileNStart, fileNEnd))
            ); */
            this.filesAreuniq.push(fileNStart);
            fileNStart = fileNEnd = fileNEnd + 1;
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

    /*private headerMaxN(nMinPrevious: number, nMaxPrevious: number, limit: number) {
        let lo = nMaxPrevious,
            // we know header macro count decreases as macro gets bigger and bigger, therefore the amount of macros in the new header will be smaller than the amount of macros in the previous header.
            hi = nMinPrevious + nMaxPrevious;

        // Binary search between lo and hi
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            const sum = this.headerSize(nMinPrevious, mid); // cumulative from nMin→mid
            if (sum <= limit) lo = mid;
            else hi = mid - 1;
        }

        return lo; // N_max
    }*/
}

function getIncludeGuard(strat: IncludeGuardStrategy, prefix: 'AREUNIQ' | 'UNIQENUM', fileIndex: number): IncludeGuard {
    switch (strat) {
        case 'classic':
            const guardName = prefix + fileIndex;
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

function sourceFilename(prefix: string, nStart: number, nEnd: number) {
    return `${prefix}${nStart}_${nEnd}.h`;
}

function includeCost(fileName: string) {
    return '#include""\n'.length + fileName.length;
}
