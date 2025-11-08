import { program } from '@commander-js/extra-typings';
import { FileWriter, StreamWriter, type CodeWriter } from './writer.js';
import { C11CodeGenerator, type CodeConfigNames } from './CodeGenerator.js';
import type { UniqenumSpec } from './types.js';
import { ident, safeParseInt, throwf } from './util.js';
import { stdout } from 'process';

program
    .name('uniqenum')
    .description('Unique enum C meta-programming macro family.')
    .arguments('<Nstart> [Nstep] [Nend]')
    .action((n1, n2, n3) => {
        // n1 : 1 n1 1
        // n1 n2 : n1 n2 1
        // n1 n2 n3 : n1 n3 n2
        generateUniqenum(
            {
                A: 127,
                D: 200,
                N: {
                    start: n2 ? intarg(n1) : 1,
                    end: intarg(n3 ?? n2 ?? n1),
                    step: n3 ? intarg(n2) : 1,
                },
            },
            //new StreamWriter(stdout)
            new FileWriter(256 * 1024, 'out')
        );
    })
    .parse();

function intarg(arg?: string) {
    return safeParseInt(arg) ?? throwf(new Error(`argument must be an number: ${arg}`))
}

function generateUniqenum(spec: Readonly<UniqenumSpec>, writer: CodeWriter): void {
    const readableNames: CodeConfigNames = {
        areuniq: n => `areuniq${n}`,
        uniqenum: n => `uniqenum${n}`,
    };

    const identNames: CodeConfigNames = {
        areuniq: n => ident((n - 2) * 2 + 1),
        uniqenum: n => ident((n - 1) * 2),
    };
    const generator = new C11CodeGenerator({
        names: readableNames,
        uniqAssertionMsg: b => b.str("duplicate enum values: ").expr(b.name).str(" ").expr(b.type)
    });
    for (let n = spec.N.start; n <= spec.N.end; n += spec.N.step) {
        let m;
        if (null !== (m = generator.areuniq(n))) writer.addCode(m);
        if (null !== (m = generator.uniqenum(n))) writer.addCode(m);
    }
    writer.flush();
}
