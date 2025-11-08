import fs from 'fs-extra';
/*
Writer -- output strategy of the generation algorithm
2 kinds out output: uniqenum and shared helpers
StreamWriter -> write all to a stram, helpers first
FilesWriter -> write all to files, with optional binning of uniqenum files capping file size
*/

export interface CodeWriter {
    addCode(code: string): void
    flush(): void;
}


export class StreamWriter implements CodeWriter {
    constructor(private readonly stream: NodeJS.WritableStream) { }
    private helpers = '';
    private code = '';
    addCode(code: string): void {
        this.code += code;
    }
    flush(): void {
        this.stream.write(this.helpers + this.code);
    }
}

export class FileWriter implements CodeWriter {
    files: string[] = [];
    constructor(private readonly maxFileSize: number, private readonly outputDir: string) {
        
    }
    addCode(content: string): void {
        const last = this.files[this.files.length - 1];
        if (last === undefined || last.length + content.length > this.maxFileSize) {
            this.files.push(content);
        } else {
            this.files[this.files.length - 1] += content;
        }
    }
    flush(): void {
        if (!this.files.length) return;
        fs.ensureDirSync(this.outputDir);
        let i = 0;
        for (const file of this.files) {
            fs.writeFileSync(`${this.outputDir}/${i++}.h`, file);
        }
    }
}