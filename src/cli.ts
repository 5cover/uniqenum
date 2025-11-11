import { program } from '@commander-js/extra-typings';
import { FileWriter, StreamWriter, type CodeWriter } from './writer.js';
import { C11CodeGenerator } from './CodeGenerator.js';
import type { UniqenumSpec } from './types.js';
import { safeParseInt, throwf } from './util.js';
import type { CodeConfigNames } from './CodeConfig.js';

generateUniqenum({
            A: 127,
            D: 200, N:{start:1,end:100}})
if (0)
program
    .name('uniqenum')
    .description('Unique enum C meta-programming macro family.')
    .arguments('<Nstart> [Nend]')
    .action((n1, n2) => {
        // n1 : 1 n1
        // n1 n2 : n1 n2
        generateUniqenum({
            A: 127,
            D: 200,
            N: {
                start: n2 ? intarg(n1) : 1,
                end: intarg(n2 ?? n1),
            },
        });
    })
    .parse();

function intarg(arg?: string) {
    return safeParseInt(arg) ?? throwf(new Error(`argument must be an number: ${arg}`));
}

function generateUniqenum(spec: UniqenumSpec): void {
    const readableNames: CodeConfigNames = {
        areuniq: ['areuniq', { ref: 'n' }],
        uniqenum: ['uniqenum', { ref: 'n' }],
    };
    const generator = new C11CodeGenerator({
        names: readableNames,
        /* assert: {
            when: 'all',
            msg: ['duplicate enum values: ', { ref: 'enumerator1' }, ' and ', { ref: 'enumerator2' }],
        }, */
        assert: { when: 'once', msg: ['duplicate enum values: ', { ref: 'name' }, ' ', { ref: 'type' }] },
    });

    const writer = new FileWriter(
        { maxFileSize: 1024, outputDir: 'out', includeGuards: 'classic' },
        spec,
        generator
    );
    // const writer = new StreamWriter(stdout, spec, generator);

    writer.generateAreuniq();
}
