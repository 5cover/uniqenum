import { program } from '@commander-js/extra-typings';
import { StreamWriter, type CodeWriter } from './writer.js';
import { C11CodeGenerator, type CodeConfigNames } from './CodeGenerator.js';
import type { UniqenumSpec } from './types.js';
import { ident, safeParseInt, throwf } from './util.js';

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
            new StreamWriter(process.stdout)
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
        areuniq: ident,
        uniqenum: ident,
    };
    const generator = new C11CodeGenerator({
        names: readableNames,
    });
    for (let n = spec.N.start; n <= spec.N.end; n += spec.N.step) {
        let m;
        if (null !== (m = generator.areuniq(n))) writer.addCode(m);
        //if (null !== (m = generator.uniqenum(n))) writer.addCode(m);
    }
    writer.flush();
}
