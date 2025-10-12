// todo: commander cli

import { program } from '@commander-js/extra-typings';
import { generateUniqenum } from './generate.js';
import { StreamWriter } from './writer.js';

program
    .name('uniqenum')
    .description('Unique enum C meta-programming macro family.')
    .argument('<N>')
    .action((_, n) => {
        console.log(n)
        generateUniqenum(
            {
                A: 127,
                D: 200,
                N: parseInt(String(n)),
            },
            new StreamWriter(process.stdout),
        );
    }).parse();
