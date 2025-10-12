import fs from 'fs';
/*
Writer -- output strategy of the generation algorithm
2 kinds out output: uniqenum and shared helpers
StreamWriter -> write all to a stram, helpers first
FilesWriter -> write all to files, with optional binning of uniqenum files capping file size
*/

export interface CodeWriter {
    addHelper(code: string): void
    addCode(code: string): void
    flush(): void;
}


export class StreamWriter implements CodeWriter {
    constructor(private readonly stream: NodeJS.WritableStream) { }
    private helpers = '';
    private code = '';
    addHelper(code: string): void {
        this.helpers += code;
    }
    addCode(code: string): void {
        this.code += code;
    }
    flush(): void {
        this.stream.write(this.helpers + this.code);
    }
}

export class FileWriter implements CodeWriter {
    constructor(private readonly maxFileSize: number = 0) { }
    addCode(content: string): void {
        //...
    }
    addHelper(code: string): void {
        //...
    }
    flush(): void {
        
    }
}