import { scopedIdentFn, ident as pureIdent } from './util.js';
import * as g from './g.js';

export interface CodeConfigNames {
    areuniq: (n: number) => string;
    uniqenum: (n: number) => string;
}

export interface CodeConfig {
    names: CodeConfigNames;
}

export abstract class CodeGenerator {
    constructor(protected readonly cfg: CodeConfig) {}
    abstract uniqenum(n: number): string | null;
    abstract areuniq(n: number): string | null;
}

export class C11CodeGenerator extends CodeGenerator {
    pivotNcliqueSmaller = Infinity;
    areuniq(n: number): string | null {
        const k = 3;

        // useless under 2
        if (n < 2) return null

        const diff = (i1: number, i2: number) => `((${pureIdent(i1)})!=(${pureIdent(i2)}))`;
        const gen = (body: string, ident = pureIdent) => defineMacro(this.cfg.names.areuniq(n), g.seq(n, ident), body);

        // trivial base case
        if (n == 2) return gen(diff(0, 1))

        // we should estimate the cost of using cliques before going through with it. example
        // areuniq3(a,b,c)areuniq2(a,b)*areuniq2(a,c)*areuniq2(b,c)
        // areuniq3(a,b,c)((a)!=(b))*((a)!=(c))*((b)!=(c))
        // second version is shorter, the macro call isn't worth it
        // implementation: don't precompute  the size: generate using both methods and pick shortest, and since size grows monotonically, we can optimize by remembering the smallest n at which expanded > clique
        const cliques = partition_cliques(n, k);
        const ident = scopedIdentFn(cliques.map(([size, _]) => this.cfg.names.areuniq(size)));
        const cliqueMacro = gen(
            g.join(
                '*',
                cliques.map(([size, clique]) => callMacro(this.cfg.names.areuniq(size), g.map(clique, ident)))
            ),
            ident
        );
        if (n >= this.pivotNcliqueSmaller) return cliqueMacro

        // try expanded, see if smaller, update pivot
        const expandedMacro = gen(g.join('*', g.map(g.combinations(n), ([a, b]) => diff(a,b))))
        if (cliqueMacro.length < expandedMacro.length) {
            this.pivotNcliqueSmaller = n
            return cliqueMacro;
        } else {
            return expandedMacro;
        }
        
    }

    uniqenum(n: number) {
        if (n < 1) return null;

        const nameUniqenum = this.cfg.names.uniqenum(n);
        const nameAreuniq = this.cfg.names.areuniq(n);
        const ident = scopedIdentFn(['enum', '_Static_assert', nameUniqenum, nameAreuniq]);
        const pName = ident(2 * n + 1);
        const pType = ident(2 * n + 2);
        const body = g.join(
            ',',
            g.seq(n, i => `${ident(n + i)}=(${ident(i)})`)
        );
        return defineMacro(
            nameUniqenum,
            (function* () {
                yield pName;
                for (const p of g.seq(2 * n, i => ident(Math.trunc(i / 2) + +!(i % 2) * n))) {
                    yield p;
                }
                yield pType;
            })(),
            `enum ${pName}{${body}}${pType};_Static_assert(${callMacro(nameAreuniq, g.seq(n, ident))},"duplicate enum values")`
        );
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

/*const c_reserved_idents = new Set()
    .add('do')
    .add('if')
    .add('for')
    .add('int')
    .add('auto')
    .add('bool')
    .add('case')
    .add('char')
    .add('else')
    .add('enum')
    .add('goto')
    .add('long')
    .add('true')
    .add('void')
    .add('break')
    .add('const')
    .add('false')
    .add('float')
    .add('short')
    .add('union')
    .add('while')
    .add('double')
    .add('extern')
    .add('inline')
    .add('return')
    .add('signed')
    .add('sizeof')
    .add('static')
    .add('struct')
    .add('switch')
    .add('typeof')
    .add('alignas')
    .add('alignof')
    .add('default')
    .add('nullptr')
    .add('typedef')
    .add('continue')
    .add('register')
    .add('restrict')
    .add('unsigned')
    .add('volatile')
    .add('constexpr')
    .add('thread_local')
    .add('static_assert')
    .add('typeof_unqual');*/
