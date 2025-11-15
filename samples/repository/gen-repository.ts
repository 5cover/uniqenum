import * as u from '../../src/index.js';

const maxSize = 1024; // 1kB

const s = u.generate({
    N: { start: 1, end: Infinity },
    maxSize,
    output: {
        type: 'directory',
        path: import.meta.dirname,
    },
});
console.log(s);
