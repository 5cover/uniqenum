import { GenerationMethod } from './types.js';
import { combinations, ident } from './util.js';

export interface CodeGenerator {
    uniqenum(n: number): string;
    areuniq(n: number): string;
}

export class C11CodeGenerator implements CodeGenerator {
    areuniq(n: number): string {
        return '';
    }
    uniqenum(n: number) {
        const params = Array.from({ length: 2 * n }, (_, i) => ident(Math.trunc(i / 2) + +!(i % 2) * n)).join(',');
        const pName = ident(2 * n + 1);
        const pType = ident(2 * n + 2);
        const body = Array.from({ length: n }, (_, i) => `${ident(n + i)}=(${ident(i)})`).join(',');
        const values = Array.from({ length: n }, (_, i) => ident(i)).join(',');
        // todo: prevent or account for ident returning "enum", "_Static_assert" or "areuniq"
        return `#define uniqenum${n}(${pName},${params},${pType})enum ${pName}{${body}}${pType};_Static_assert(areuniq(${values}),"duplicate enum values")\n`;
    }
}

function partition_cliques(n: number) {
    // split graph in k parts of size (node count) n / K + +(i < n % k), i being the subgraph number (the +() parrt allows to account for when n % k != 0)
    const k = 3;
    if (n < k) {
        throw new Error('n must be greater than K. use a base case.')
    }
    const basesize = Math.trunc(n / k);

    const subcliques: number[][] = [];

    for (const [iStart, iEnd] of combinations(k)) {
        // iStart and iEnd are graph part numbers
        // compute the subcliques as an union of two subgraphs

        // amount of nodes before iStart
        const iStartOffset = iStart * basesize + Math.min(iStart, n % k);
        const iEndOffset = iEnd * basesize + Math.min(iEnd, n % k);
        subcliques.push([
            ...Array.from({ length: basesize + +(iStart < n % k)}, (_, i) => {
                return iStartOffset + i;
            }),
            ...Array.from({ length: basesize + +(iEnd < n % k) }, (_, i) => {
                return iEndOffset + i;
            })
        ]);
    }

    return subcliques;
    // return subcliques [a,b,c] [c,d,e]
}

console.log(JSON.stringify(partition_cliques(2), null, 2));

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
