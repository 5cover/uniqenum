import fs from 'fs-extra';
/*
Writer -- output strategy of the generation algorithm
2 kinds out output: uniqenum and shared helpers
StreamWriter -> write all to a stram, helpers first
FilesWriter -> write all to files, with optional binning of uniqenum files capping file size
*/

export interface CodeWriter {
    addAreuniq(n: number, code: string): void;
    addUniquenum(n: number, code: string): void;
    flush(): void;
}

export class StreamWriter implements CodeWriter {
    constructor(private readonly stream: NodeJS.WritableStream) {}
    private helpers = '';
    private code = '';
    addAreuniq(n: number, code: string): void {
        this.code += code;
    }
    addUniquenum(n: number, code: string): void {
        this.code += code;
    }
    flush(): void {
        this.stream.write(this.helpers + this.code);
    }
}

type FileInfo = [startN: number, code: string];

export interface FileWriterConfig {
    maxFileSize: number,
    outputDir: string,
    maxN: number,
    includeGuards: 'omit' | 'pragma once' | 'classic'
}

export class FileWriter implements CodeWriter {
    filesAreuniq: FileInfo[] = [];
    filesUniqenum: FileInfo[] = [];
    constructor(private readonly cfg: Readonly<FileWriterConfig>) {}
    addAreuniq(n: number, code: string): void {
        this.add(n, code, this.filesAreuniq);
    }
    addUniquenum(n: number, code: string): void {
        this.add(n, code, this.filesUniqenum);
    }

    private add(n: number, code: string, to: FileInfo[]) {
        const last = to[to.length - 1];
        if (last === undefined || last.length + code.length > this.cfg.maxFileSize) {
            to.push([n, code]);
        } else {
            last[1] += code;
        }
    }

    flush(): void {
        if (!this.filesAreuniq.length) return;
        fs.ensureDirSync(this.cfg.outputDir);
        this.writeFiles('areuniq', this.filesAreuniq);
        this.filesAreuniq = [];
        this.writeFiles('uniqenum', this.filesUniqenum);
        this.filesUniqenum = [];
    }

    writeFiles(prefix: string, files: readonly FileInfo[]): void {
        for (let i = 0; i < files.length; ++i) {
            const [startN, file] = files[i]!;
            const next = files[i + 1];
            const endN = next === undefined ? this.cfg.maxN : next[0] - 1;
            const name = `${prefix}${startN}_${endN}`;
            fs.writeFileSync(`${this.cfg.outputDir}/${name}.h`, file);
        }
    }
}
