import { scopedIdentFn, ident as pureIdent } from './util.js';
import * as g from './g.js';

/**
 * Configurration names. It's up to you to provide unique names.
 */
export interface CodeConfigNames {
    areuniq: (n: number) => string;
    uniqenum: (n: number) => string;
}

export class CStringUniqAssertionMsgBuilder {
    constructor(
        readonly n: number,
        readonly ident = pureIdent
    ) {}
    private code = '';
    private instr = false;
    str(str: string) {
        if (!this.instr) {
            this.code += '"';
            this.instr = true;
        }
        this.code += str.replaceAll(/["\\]/g, '\\$&').replaceAll('\n', '\\n').replaceAll('\r', '\\r');
        return this;
    }

    expr(expr: string) {
        this.closeStr();
        this.code += '#';
        this.code += expr;
        return this;
    }

    forEach<T>(items: Iterable<T>, $do: (builder: this, item: T) => unknown) {
        for (const item of items) {
            $do(this, item);
        }
        return this;
    }

    get name() {
        return this.ident(2 * this.n + 1);
    }

    get type() {
        return this.ident(2 * (this.n + 1));
    }

    values() {
        return g.seq(this.n, i => [this.ident(this.n + i), this.ident(i)] as const);
    }

    toString() {
        this.closeStr();
        return this.code;
    }

    private closeStr() {
        if (!this.instr) return;
        this.code += '"';
        this.instr = false;
    }
}

export interface CodeConfig {
    names: CodeConfigNames;
    /**
     * Produce the
     */
    uniqAssertionMsg: (builder: CStringUniqAssertionMsgBuilder) => CStringUniqAssertionMsgBuilder;
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
        if (n < 2) return null;

        const diff = (i1: number, i2: number) => `((${pureIdent(i1)})!=(${pureIdent(i2)}))`;
        const gen = (body: string, ident = pureIdent) => defineMacro(this.cfg.names.areuniq(n), g.seq(n, ident), body);

        // trivial base case
        if (n == 2) return gen(diff(0, 1));

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
        if (n >= this.pivotNcliqueSmaller) return cliqueMacro;

        // try expanded, see if smaller, update pivot
        const expandedMacro = gen(
            g.join(
                '*',
                g.map(g.combinations(n), ([a, b]) => diff(a, b))
            )
        );
        if (cliqueMacro.length < expandedMacro.length) {
            this.pivotNcliqueSmaller = n;
            return cliqueMacro;
        } else {
            return expandedMacro;
        }
    }

    uniqenum(n: number) {
        if (n < 1) return null;
        const nameUniqenum = this.cfg.names.uniqenum(n);
        if (n === 1) {
            return gen(new CStringUniqAssertionMsgBuilder(n));
        }
        const nameAreuniq = this.cfg.names.areuniq(n);
        const builder = new CStringUniqAssertionMsgBuilder(
            n,
            scopedIdentFn(['enum', '_Static_assert', nameUniqenum, nameAreuniq])
        );
        return gen(
            builder,
            `;_Static_assert(${callMacro(nameAreuniq, g.seq(n, builder.ident))},${this.cfg.uniqAssertionMsg(builder)})`
        );

        function gen(builder: CStringUniqAssertionMsgBuilder, rest: string = '') {
            const body = g.join(
                ',',
                g.map(builder.values(), ([k, v]) => `${k}=(${v})`)
            );
            return defineMacro(nameUniqenum, params(builder), `enum ${builder.name}{${body}}${builder.type}` + rest);
        }

        function* params(builder: CStringUniqAssertionMsgBuilder) {
            yield builder.name;
            for (const p of g.seq(2 * n, i => builder.ident(Math.trunc(i / 2) + +!(i % 2) * n))) {
                yield p;
            }
            yield builder.type;
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
