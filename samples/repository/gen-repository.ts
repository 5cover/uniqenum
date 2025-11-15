import * as u from '../../src/index.js';

const maxSize = 1024;

const s = u.generate({
    N: { start: 1, end: Infinity },
    maxSize,
    output: {
        type: 'directory',
        path: import.meta.dirname,
        prefixSubdirectoryLength: 1,
    },
});
console.log(s);
