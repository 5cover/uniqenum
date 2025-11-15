import * as u from '../src/index.js';
import fs from 'fs';
import path from 'path';

const SIZE_INCREMENT = 128 * 1024; // 128 KB
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const SCRATCH_PATH = path.join(import.meta.dirname, 'output.h');
let maxSize = SIZE_INCREMENT;

while (maxSize <= MAX_SIZE) {
    const s = u.generate({
        N: { start: 1, end: Infinity },
        maxSize,
        output: {
            type: 'file',
            path: SCRATCH_PATH,
        },
    });
    const filename = path.join(import.meta.dirname, `uniqenum_${s.uniqenum.end}.h`);
    console.log(`generated ${filename} (max size: ${maxSize} bytes)`);
    maxSize += SIZE_INCREMENT;
    fs.renameSync(SCRATCH_PATH, filename);
}
