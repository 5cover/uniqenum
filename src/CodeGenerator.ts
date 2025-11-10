import {
    scopedIdentFn,
    ident as pureIdent,
    type IdentFn,
    identAntecedent,
    identAntecedentAssert,
} from './ident.js';
import * as g from './g.js';
import { type CodeConfig } from './CodeConfig.js';
import * as fmt from './format.js';
import { type Writer, type Teller, join, measureLength } from './writing.js';
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
    abstract uniqenum(n: number): Teller;
    abstract uniqenumSize(n: number): number;
    /**
     * Generate the Areuniq macro.
     * @param {number} n
     * @returns {string}
     * Invariant: areuniq(n + m) >= areuniq(n)
     * Invariant: areuniq(n) is pure
     *
     */
    abstract areuniq(n: number): Teller;
    abstract areuniqSize(n: number): number;
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

    areuniq(n: number): Teller {
        // useless under 2
        if (n < 2) return o => o;

        // trivial base case
        if (n === 2) {
            return this.genAreuniq(n, this.pair(0, 1));
        }

        const k = 3;

        // we should estimate the cost of using cliques before going through with it. example
        // areuniq3(a,b,c)areuniq2(a,b)*areuniq2(a,c)*areuniq2(b,c)
        // areuniq3(a,b,c)((a)!=(b))*((a)!=(c))*((b)!=(c))
        // second version is shorter, the macro call isn't worth it
        // implementation: don't precompute  the size: generate using both methods and pick shortest, and since size grows monotonically, we can optimize by remembering the smallest n at which expanded > clique
        const cliques = this.partitionCliques(n, k);
        const ident = scopedIdentFn(cliques.map(([name]) => name.i).filter(i => i !== null));
        const cliqueMacro = this.genAreuniq(
            n,
            join(this.cfg.assert.when === 'all' ? ';' : '*', cliques, ([name, clique]) =>
                callMacro(name.ident, g.map(clique, ident))
            ),
            ident
        );
        if (n >= this.pivotNcliqueSmaller) return cliqueMacro;

        
        const expandedMacro = this.genAreuniq(
            n,
            join('*', g.combinations(n), ([a, b]) => this.pair(a, b))
        );
        // calculate expanded cost, see if smaller, update pivot
        const expandedCost = measureLength(expandedMacro);
        const cliqueCost = measureLength(cliqueMacro);
        if (expandedCost < cliqueCost) {
            this.pivotNcliqueSmaller = n;
            return cliqueMacro;
        }
        return expandedMacro;
    }

    override areuniqSize(n: number): number {
        return measureLength(this.areuniq(n));
    }

    private pair(i1: number, i2: number) {
        return (o: Writer) => {
            const enumerator1 = pureIdent(i1);
            const enumerator2 = pureIdent(i2);
            return this.cfg.assert.when === 'all'
                ? o('_Static_assert(')('((')(enumerator1)(')!=(')(enumerator2)('))')(',')(
                      fmt.format(fmt.string, this.cfg.assert.msg, { enumerator1, enumerator2 })
                  )(')')
                : o('((')(enumerator1)(')!=(')(enumerator2)('))');
        };
    }
    private genAreuniq(n: number, body: Teller, ident = pureIdent) {
        return defineMacro(this.nameAreuniq.get(n).ident, g.seq(n, ident), body);
    }

    uniqenum(n: number): Teller {
        if (n < 1) return o => o;
        const nameUniqenum = fmt.format(fmt.string, this.cfg.names.uniqenum, { n: n.toString() });
        if (n === 1) {
            return this.genUniqenum(nameUniqenum, new UniqenumInfo(n, pureIdent));
        }

        const scope = [iaEnum];
        {
            let ia: number | null;
            if (null !== (ia = identAntecedent(nameUniqenum))) scope.push(ia);
            if (null !== (ia = identAntecedent(this.nameAreuniq.get(n).ident))) scope.push(ia);
        }
        const info = new UniqenumInfo(n, scopedIdentFn(scope));
        const areuniqCall = callMacro(this.nameAreuniq.get(n).ident, info.keys());
        return this.genUniqenum(nameUniqenum, info, o =>
            this.cfg.assert.when === 'all'
                ? o(';')(areuniqCall)
                : o(';_Static_assert(')(areuniqCall)(
                      fmt.format(fmt.string, this.cfg.assert.msg, {
                          n: n.toString(),
                          name: info.name,
                          type: info.type,
                      })
                  )
        );
    }

    override uniqenumSize(n: number): number {
        return measureLength(this.uniqenum(n));
    }

    private genUniqenum(name: string, info: UniqenumInfo, rest?: Teller) {
        const body = join(',', g.unzip([info.keys(), info.values()]), x => x.join(' '));
        return defineMacro(name, info.params(), o => o('enum ')(info.name)('{')(body)('}')(info.type)(rest));
    }

    /**
     * split graph in k parts of size (node count) n / K + +(i < n % k), i being the subgraph number (the +() parrt allows to account for when n % k != 0)
     */
    private partitionCliques(n: number, k: number) {
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

function defineMacro(name: string, params: Iterable<string>, body: Teller) {
    return (o: Writer) => o('#define ')(callMacro(name, params))(body)('\n');
}

function callMacro(name: string, args: Iterable<string>) {
    return (o: Writer) => o(name)('(')(join(',', args, x => x))(')');
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
