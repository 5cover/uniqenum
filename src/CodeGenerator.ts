import { scopedIdentFn, ident as pureIdent } from './ident.js';
import * as g from './g.js';
import { CStringBuilder } from './CStringBuilder.js';
import { AssertOnceInfo, type CodeConfig } from './CodeConfig.js';

export abstract class CodeGenerator {
    constructor(protected readonly cfg: CodeConfig) {}
    abstract uniqenum(n: number): string | null;
    abstract areuniq(n: number): string | null;
}

export class C11CodeGenerator extends CodeGenerator {
    pivotNcliqueSmaller = Infinity;
    areuniq(n: number): string | null {
        // useless under 2
        if (n < 2) return null;

        // trivial base case
        if (n === 2) return this.gen(n, this.diff(0, 1));

        const k = 3;

        // we should estimate the cost of using cliques before going through with it. example
        // areuniq3(a,b,c)areuniq2(a,b)*areuniq2(a,c)*areuniq2(b,c)
        // areuniq3(a,b,c)((a)!=(b))*((a)!=(c))*((b)!=(c))
        // second version is shorter, the macro call isn't worth it
        // implementation: don't precompute  the size: generate using both methods and pick shortest, and since size grows monotonically, we can optimize by remembering the smallest n at which expanded > clique
        const cliques = partition_cliques(n, k);
        const ident = scopedIdentFn(cliques.map(([size, _]) => this.cfg.names.areuniq(size)));
        const cliqueMacro = this.gen(
            n,
            g.join(
                this.cfg.assert.when === 'all' ? ';' : '*',
                cliques.map(([size, clique]) => callMacro(this.cfg.names.areuniq(size), g.map(clique, ident)))
            ),
            ident
        );
        if (n >= this.pivotNcliqueSmaller) return cliqueMacro;

        // try expanded, see if smaller, update pivot
        const expandedMacro = this.gen(
            n,
            g.join(
                '*',
                g.map(g.combinations(n), ([a, b]) => this.diff(a, b))
            )
        );
        if (cliqueMacro.length < expandedMacro.length) {
            this.pivotNcliqueSmaller = n;
            return cliqueMacro;
        } else {
            return expandedMacro;
        }
    }

    private diff(i1: number, i2: number) {
        const enumerator1 = pureIdent(i1);
        const enumerator2 = pureIdent(i2);
        const expr = `((${pureIdent(i1)})!=(${pureIdent(i2)}))`;
        return this.cfg.assert.when === 'all'
            ? `_Static_assert(${expr},${this.cfg.assert.msg(new CStringBuilder(), { enumerator1, enumerator2 })})`
            : expr;
    }
    private gen(n: number, body: string, ident = pureIdent) {
        return defineMacro(this.cfg.names.areuniq(n), g.seq(n, ident), body);
    }

    uniqenum(n: number) {
        if (n < 1) return null;
        const nameUniqenum = this.cfg.names.uniqenum(n);
        if (n === 1) {
            return gen(new AssertOnceInfo(n, pureIdent));
        }
        const nameAreuniq = this.cfg.names.areuniq(n);
        const info = new AssertOnceInfo(n, scopedIdentFn(['enum', '_Static_assert', nameUniqenum, nameAreuniq]));
        const areuniqCall = callMacro(nameAreuniq, info.keys());
        return gen(
            info,
            this.cfg.assert.when === 'all'
                ? `;${areuniqCall}`
                : `;_Static_assert(${areuniqCall},${this.cfg.assert.msg(new CStringBuilder(), info)})`
        );

        function gen(info: AssertOnceInfo, rest: string = '') {
            const body = g.join(
                ',',
                g.map(g.unzip([info.keys(), info.values()]), x => x.join(' '))
            );
            return defineMacro(nameUniqenum, info.params(), `enum ${info.name}{${body}}${info.type}` + rest);
        }
    }
}

function defineMacro(name: string, params: Iterable<string>, body: string) {
    return `#define ${callMacro(name, params)}${body}\n`;
}

function callMacro(name: string, args: Iterable<string>) {
    return `${name}(${g.join(',', args)})`;
}

/**
 * split graph in k parts of size (node count) n / K + +(i < n % k), i being the subgraph number (the +() parrt allows to account for when n % k != 0)
 */
function partition_cliques(n: number, k: number) {
    if (n < k) {
        throw new Error('n must be greater than K. use a base case.');
    }
    const basesize = Math.trunc(n / k);

    const cliques: [n: number, Generator<number>][] = [];
    for (const [iStart, iEnd] of g.combinations(k)) {
        // iStart and iEnd are graph part numbers
        // compute the subcliques as an union of two subgraphs

        // amount of nodes before iStart
        const iStartOffset = iStart * basesize + Math.min(iStart, n % k);
        const iEndOffset = iEnd * basesize + Math.min(iEnd, n % k);
        const size1 = basesize + +(iStart < n % k);
        const size2 = basesize + +(iEnd < n % k);
        cliques.push([
            size1 + size2,
            g.cat(
                g.seq(size1, i => iStartOffset + i),
                g.seq(size2, i => iEndOffset + i)
            ),
        ]);
    }
    return cliques;
}
