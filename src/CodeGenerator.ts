import { scopedIdentFn, ident as pureIdent, type IdentFn, identAntecedent, identAntecedentAssert } from './ident.js';
import * as g from './g.js';
import { type CodeConfig } from './CodeConfig.js';
import * as fmt from './format.js';
import { LengthWriter, type Writer, type Teller } from './writing.js';
import { StableCache } from './StableCache.js';

export abstract class CodeGenerator {
    constructor(protected readonly cfg: CodeConfig) {}
    /**
     * Generate the Uniqenum macro.
     * @abstract
     * @param {number} n
     * @returns {string}
     * Invariant: uniqenum(n + m) >= uniqenum(n)
     * Invariant: uniqenum(n) is pure
     */
    abstract readonly uniqenum: (w: Writer, n: number) => Writer;
    /**
     * Generate the Areuniq macro.
     * @param {number} n
     * @returns {string}
     * Invariant: areuniq(n + m) >= areuniq(n)
     * Invariant: areuniq(n) is pure
     *
     */
    abstract readonly areuniq: (w: Writer, n: number) => Writer;
}

const iaEnum = identAntecedentAssert('enum');

interface IdentAntecedentPair {
    ident: string;
    i: number | null;
}

export class C11CodeGenerator extends CodeGenerator {
    pivotNcliqueSmaller = Infinity;

    private readonly nameAreuniq = new StableCache<number, { ident: string; i: number | null }>(n => {
        const ident = fmt.format(fmt.string, this.cfg.names.areuniq, { n: n.toString() });
        return {
            ident,
            i: identAntecedent(ident),
        };
    });

    readonly areuniq = (w: Writer, n: number) => {
        // useless under 2
        if (n < 2) return w;

        // trivial base case
        if (n === 2) {
            return this.genAreuniq(w, n, w => this.pair(w, 0, 1));
        }

        // we should estimate the cost of using cliques before going through with it. example
        // areuniq3(a,b,c)areuniq2(a,b)*areuniq2(a,c)*areuniq2(b,c)
        // areuniq3(a,b,c)((a)!=(b))*((a)!=(c))*((b)!=(c))
        // second version is shorter, the macro call isn't worth it
        // implementation: don't precompute  the size: generate using both methods and pick shortest, and since size grows monotonically, we can optimize by remembering the smallest n at which expanded > clique

        if (n >= this.pivotNcliqueSmaller) return this.areuniqCliques(w, n);

        // calculate expanded cost, see if smaller, update pivot
        const cliqueCost = LengthWriter.ret(this.areuniqCliques, n);
        const expandedCost = LengthWriter.ret(this.areuniqExpanded, n);
        if (expandedCost < cliqueCost) {
            this.pivotNcliqueSmaller = n;
            return this.areuniqCliques(w, n);
        }
        return this.areuniqExpanded(w, n);
    }

    private readonly areuniqCliques = (w: Writer, n: number) => {
        const k = 3;
        const cliques = this.partitionCliques(n, k);
        const ident = scopedIdentFn(cliques.map(([name]) => name.i).filter(i => i !== null));
        return this.genAreuniq(
            w,
            n,
            w =>
                w.join(this.cfg.assert.when === 'all' ? ';' : '*', cliques, (w, [name, clique]) =>
                    callMacro(w, name.ident, g.map(clique, ident))
                ),
            ident
        );
    }

    private readonly areuniqExpanded = (w: Writer, n: number) => {
        return this.genAreuniq(w, n, w => w.join('*', g.combinations(n), (w, [a, b]) => this.pair(w, a, b)));
    }

    private readonly pair = (w: Writer, i1: number, i2: number) => {
        const enumerator1 = pureIdent(i1);
        const enumerator2 = pureIdent(i2);
        return this.cfg.assert.when === 'all'
            ? w
                  .str('_Static_assert(')
                  .str('((')
                  .str(enumerator1)
                  .str(')!=(')
                  .str(enumerator2)
                  .str('))')
                  .str(',')
                  .str(fmt.format(fmt.cstring, this.cfg.assert.msg, { enumerator1, enumerator2 }))
                  .str(')')
            : w.str('((').str(enumerator1).str(')!=(').str(enumerator2).str('))');
    }
    private readonly genAreuniq = (w: Writer, n: number, body: Teller, ident = pureIdent) => {
        return defineMacro(w, this.nameAreuniq.get(n).ident, g.seq(n, ident), body);
    }

    readonly uniqenum = (w: Writer, n: number) => {
        if (n < 1) return w;
        const nameUniqenum = fmt.format(fmt.string, this.cfg.names.uniqenum, { n: n.toString() });
        if (n === 1) {
            return this.genUniqenum(w, nameUniqenum, new UniqenumInfo(n, pureIdent));
        }

        const scope = [iaEnum];
        {
            let ia: number | null;
            if (null !== (ia = identAntecedent(nameUniqenum))) scope.push(ia);
            if (null !== (ia = identAntecedent(this.nameAreuniq.get(n).ident))) scope.push(ia);
        }
        const info = new UniqenumInfo(n, scopedIdentFn(scope));
        const a1 = this.nameAreuniq.get(n).ident;
        const a2 = info.keys();
        return this.genUniqenum(w, nameUniqenum, info, w =>
            this.cfg.assert.when === 'all'
                ? callMacro(w.str(';'), a1, a2)
                : callMacro(w.str(';_Static_assert('), a1, a2)
                      .str(',')
                      .str(
                          fmt.format(fmt.cstring, this.cfg.assert.msg, {
                              n: n.toString(),
                              name: info.name,
                              type: info.type,
                          })
                      )
                      .str(')')
        );
    }

    private readonly genUniqenum = (w: Writer, name: string, info: UniqenumInfo, rest?: Teller) => {
        return defineMacro(w, name, info.params(), w => {
            w.str('enum ')
                .str(info.name)
                .str('{')
                .join(',', g.unzip([info.keys(), info.values()]), (w, x) => w.join(' ', x))
                .str('}')
                .str(info.type);
            rest?.(w);
        });
    }

    /**
     * split graph in k parts of size (node count) n / K + +(i < n % k), i being the subgraph number (the +() parrt allows to account for when n % k != 0)
     */
    private readonly partitionCliques = (n: number, k: number) => {
        if (n < k) {
            throw new Error('n must be greater than K. use a base case.');
        }
        const basesize = Math.trunc(n / k);

        const cliques: [name: IdentAntecedentPair, items: Generator<number>][] = [];
        for (const [iStart, iEnd] of g.combinations(k)) {
            // iStart and iEnd are graph part numbers
            // compute the subcliques as an union of two subgraphs

            // amount of nodes before iStart
            const iStartOffset = iStart * basesize + Math.min(iStart, n % k);
            const iEndOffset = iEnd * basesize + Math.min(iEnd, n % k);
            const size1 = basesize + +(iStart < n % k);
            const size2 = basesize + +(iEnd < n % k);
            cliques.push([
                this.nameAreuniq.get(size1 + size2),
                g.cat(
                    g.seq(size1, i => iStartOffset + i),
                    g.seq(size2, i => iEndOffset + i)
                ),
            ]);
        }
        return cliques;
    }
}

function defineMacro(w: Writer, name: string, params: Iterable<string>, body: Teller) {
    callMacro(w.str('#define '), name, params);
    body(w);
    return w.str('\n');
}

function callMacro(w: Writer, name: string, args: Iterable<string>) {
    return w
        .str(name)
        .str('(')
        .join(',', args, (w, x) => w.str(x))
        .str(')');
}

class UniqenumInfo {
    constructor(
        readonly n: number,
        private readonly ident: IdentFn
    ) {}

    get name() {
        return this.ident(2 * this.n + 1);
    }

    get type() {
        return this.ident(2 * (this.n + 1));
    }

    values() {
        return g.seq(this.n, i => this.ident(this.n + i));
    }

    keys() {
        return g.seq(this.n, this.ident);
    }

    *params() {
        yield this.name;
        for (const p of g.seq(2 * this.n, i => this.ident(Math.trunc(i / 2) + +(i % 2) * this.n))) {
            yield p;
        }
        yield this.type;
    }
}
