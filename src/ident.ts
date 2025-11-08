const MaxCacheSize = 16384;
const identCache = new Map<number, string>();

const n2char = new Map<number, string>();
const char2n = new Map<string, number>();
const F = 52; // letters
const B = 63; // letters + _ + digits
buildCharMap(97, 0, 26); // lower letters
buildCharMap(39, 26, 52); // upper letters
buildCharMap('_', 52);
buildCharMap(-4, 53, 62); // digits 1-9
buildCharMap('0', 62);

export type IdentFn = typeof ident;

/**
 * Create a callable ident function that skips some identifiers to avoid shadowing a scope, getting the next valid one.
 */
export function scopedIdentFn(scope: Iterable<string> = []): IdentFn {
    const sortedSkips = Array.from(scope, identAntecedent).filter(i => i !== null).sort((a, b) => a - b);
    return i => {
        for (const s of sortedSkips) {
            if (s > i) break;
            else i++
        }
        return ident(i);
    }
}

/**
 * Bijective function that encodes an integer as a valid C identifier.
 * It may return a keyword. Skipping not implemented as macor parameters may be keywords since the C parser doesn't see them, only the preprocessor.
 */
export function ident(i: number): string {
    const cached = identCache.get(i);
    if (cached !== undefined) return cached;
    const s = pureIdent(i);
    if (identCache.size <= MaxCacheSize) identCache.set(i, s);
    return s;
}

/**
 * Inverse of ident(i). Returns the raw integer index whose image is `s`.
 * Throws if `s` contains a character not in the alphabet.
 * @returns a number i as ident(i)===s, or null if s is not an ident
 */
export function identAntecedent(s: string): number | null {
    if (s.length === 0) return null;

    const L = s.length;

    const firstIdx = char2n.get(s[0]!);
    if (firstIdx === undefined || firstIdx >= F) return null;

    let value = 0;
    for (let pos = 1; pos < L; ++pos) {
        const idx = char2n.get(s[pos]!);
        if (idx === undefined) return null;
        value = value * B + idx;
    }

    // number of identifiers with shorter length
    const base = (F * (B ** (L - 1) - 1)) / (B - 1);

    return base + firstIdx * B ** (L - 1) + value;
}

function pureIdent(i: number): string {
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
        return n2char.get(rem)!;
    }

    const first_idx = Math.trunc(rem / B ** (L - 1));
    let rest = rem % B ** (L - 1);

    let s = '';
    for (let pos = 0; pos < L - 1; ++pos) {
        const power = B ** (L - 2 - pos);
        const d = Math.trunc(rest / power);
        rest %= power;
        s += n2char.get(d);
    }

    return n2char.get(first_idx)! + s;
}

function buildCharMap(offsetOrChar: number | string, iStart: number, iEnd: number = iStart + 1) {
    for (let i = iStart; i < iEnd; ++i) {
        const chr = typeof offsetOrChar === 'string' ? offsetOrChar : String.fromCharCode(offsetOrChar + i);
        n2char.set(i, chr);
        char2n.set(chr, i);
    }
}
