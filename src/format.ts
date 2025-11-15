import { StableCache } from './StableCache.js';
import type { Writer } from './writing.js';

export type Input<Ref> = (string | { ref: Ref })[];

interface Builder<T, TAgg> {
    start(): TAgg;
    str(a: TAgg, v: string): TAgg;
    ref(a: TAgg, v: T, k: string): TAgg;
    end(a: TAgg): T;
}

export function format<T, Ref extends string>(b: Builder<T, unknown>, fmt: Input<Ref>, args: Record<Ref, T>): T {
    let agg = b.start();
    for (const f of fmt) {
        if (typeof f === 'object' && 'ref' in f) {
            agg = b.ref(agg, args[f.ref], f.ref);
        } else {
            agg = b.str(agg, f);
        }
    }
    return b.end(agg);
}

export const string: Builder<string, string> = {
    start: () => '',
    str: (a, v) => (a += v),
    ref: (a, v) => (a += v),
    end: a => a,
};

export const cstring: Builder<string, { code: string; lastref?: string }> = {
    start: () => ({ code: '' }),
    str: (a, v) => {
        const al = a.lastref;
        if (al || !a.code) {
            // (L, R [which is a gnu extension](https://gcc.gnu.org/onlinedocs/gcc/Raw-String-Literals.html?utm_source=chatgpt.com), u, U, u8): must be followed by a space: `#L"etc"` is an error, must be `#L "etc"`: https://en.cppreference.com/w/c/language/string_literal.html
            if (al && (al[0] === 'L' || al[0] === 'R' || al[0] === 'U' || al[0] === 'u')) {
                a.code += ' ';
            }
            a.code += '"';
            a.lastref = undefined;
        }
        a.code += escapeCString.get(v);
        return a;
    },
    ref: (a, v) => {
        if (!v) return a;
        if (!a.lastref) {
            a.code += '"';
        }
        a.code += '#';
        a.code += a.lastref = v;
        return a;
    },
    end: a => (a.lastref ? a.code : a.code + '"'),
};

/**
 * Escape strategy:
 * - Use named short escapes for common control chars.
 * - For code <= 511: emit octal (minimal digits), but pad to 3 digits if the next char is [0-7].
 * - For code >= 512:
 *    - if next char is not hexadecimal-start, emit \xHEX (no padding)
 *    - else choose the cheapest among:
 *       - \xHEX"" (cost = 4 + d)
 *       - \uXXXX (cost = 6) if fits (d <= 4)
 *       - \UXXXXXXXX (cost = 10) if fits (d <= 8)
 *    - on ties prefer the unicode form (\u or \U).
 * This function returns the escaped fragment (no surrounding quotes) and may
 * insert string-concat quotes ("") when necessary (the "split" option).
 */
export const escapeCString = new StableCache((src: string) => {
    let s = '';
    for (let i = 0; i < src.length; ++i) {
        const c = src.charCodeAt(i);
        switch (c) {
            case 7:
                s += '\\a';
                break;
            case 8:
                s += '\\b';
                break;
            case 9:
                s += '\\t';
                break;
            case 10:
                s += '\\n';
                break;
            case 11:
                s += '\\v';
                break;
            case 12:
                s += '\\f';
                break;
            case 13:
                s += '\\r';
                break;
            case 34:
                s += '\\"';
                break;
            case 92:
                s += '\\\\';
                break;
            default:
                if (32 <= c && c <= 126) {
                    s += src[i]!;
                    continue;
                }
                // the octal escape sequence is always shorter or same length as the equivalent hex \0
                let nextChar = src.charCodeAt(i + 1);
                if (c <= 0o777) {
                    // 0x200
                    const cs = c.toString(8);
                    s += '\\';
                    s += 48 <= nextChar && nextChar <= 55 ? cs.padStart(3, '0') : cs;
                    continue;
                }
                // normalize lowercase to uppercase: 'a'..'f' -> 'A'..'F'
                nextChar &= ~0x20; // & coerces NaN to 0
                // now we only need to check '0'..'9' and 'A'..'F'
                if (nextChar - 48 <= 9 || nextChar - 65 <= 5) {
                    // c > 0x200 - and our min size for \u is 0x10
                    s += '\\u';
                    s += c.toString(16).padStart(4, '0');
                    continue;
                }
                // no next: can use \\x
                s += '\\x';
                s += c.toString(16);
        }
    }
    return s;
}, 16384);
