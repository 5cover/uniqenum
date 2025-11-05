const MaxCacheSize = 16384;
const identCache = new Map<number, string>();
const chars = new Map<number, string>();

buildCharMap(97, 0, 26); // lower letters
buildCharMap(39, 26, 52); // upper letters
buildCharMap('_', 52);
buildCharMap(-4, 53, 62); // digits 1-9
buildCharMap('0', 62);

function buildCharMap(offsetOrChar: number | string, iStart: number, iEnd: number = iStart + 1) {
    for (let i = iStart; i < iEnd; ++i) {
        chars.set(i, typeof offsetOrChar === 'string' ? offsetOrChar : String.fromCharCode(offsetOrChar + i));
    }
}

class SkipMap {
    constructor(private readonly bannedIdents: ReadonlySet<string>) {}

    sortedSkips: number[] = [];

    ident(i: number) {
        const offset = this.offset(i);
        let s = ident(i + offset);
        while (this.bannedIdents.has(s)) {
            this.sortedSkips.splice(offset, 0, i);
            s = ident(++i + offset);
        }
        return s;
    }

    private offset(i: number): number {
        let low = 0,
            high = this.sortedSkips.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (this.sortedSkips[mid]! <= i) low = mid + 1;
            else high = mid;
        }
        return low;
    }
}

/**
 * Create a callable ident function that skips some identifiers, getting the next valid one.
 */
export function fnIdentSkip(banned: ReadonlySet<string>) {
    const instance = new SkipMap(banned);
    const fn = instance.ident satisfies typeof ident as typeof ident & SkipMap;
    Object.setPrototypeOf(fn, SkipMap.prototype);
    return Object.assign(fn, instance);
}

/**
 * Bijective function that encodes an integer as a valid C identifier.
 * It may return a keyword. Skipping not implemented as macor parameters may be keywords since the C parser doesn't see them, only the preprocessor.
 */
export function ident(i: number): string {
    const cached = identCache.get(i);
    if (cached !== undefined) return cached;
    // todo: see if the effective pattern of ident(i) is compatible with the cache strategy
    const s = buildIdent(i);
    if (identCache.size <= MaxCacheSize) identCache.set(i, s);
    return s;
}

function buildIdent(i: number): string {
    const F = 52; // letters
    const B = 63; // letters + _ + digits

    if (i < 0) {
        throw Error(`i must be >= 0, got ${i}`);
    }

    let L = 1;
    let rem = i;

    while (true) {
        const count_L = F * B ** (L - 1);
        if (rem < count_L) {
            break;
        }
        rem -= count_L;
        L++;
    }

    if (L === 1) {
        return chars.get(rem)!;
    }

    const first_idx = Math.trunc(rem / B ** (L - 1));
    let rest = rem % B ** (L - 1);

    let s = '';
    ('${workspaceFolder}/src/cli.ts');
    for (let pos = 0; pos < L - 1; ++pos) {
        const power = B ** (L - 2 - pos);
        const d = Math.trunc(rest / power);
        rest %= power;
        s += chars.get(d);
    }

    return chars.get(first_idx)! + s;
}

export function* combinations(n: number): Generator<[number, number], void, void> {
    for (let i = 0; i < n; ++i) {
        for (let j = i + 1; j < n; ++j) {
            yield [i, j];
        }
    }
}

export function sequence<T>(length: number, map: (i: number) => T) {
    return Array.from({ length }, (_, i) => map(i));
}
