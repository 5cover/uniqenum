import path from 'path';
import type { range } from './types.js';
import { createInterface } from 'readline/promises';
import { stdin } from 'process';

/**
 * A parseInt variant that never returns NaN and fails with null instead.
 */
export function safeParseInt(str: string | undefined | null): number | null {
    if (!str) return null;
    const n = parseInt(str);
    return isNaN(n) ? null : n;
}

/**
 * Throw expression
 */
export function throwf(err: Error): never {
    throw err;
}

/**
 * Returns the lower bounds of ranges that intersect a given interval [start, end].
 *
 * Each range is implicitly defined by an array `bounds` of sorted lower limits:
 *  - bounds[i] is the start of the i-th range
 *  - bounds[i+1] - 1 is the end of the i-th range
 *  - The final range ends at bounds[bounds.length - 1]
 *
 * Example:
 * ```ts
 * const B = [1, 50, 100, 101];
 * // Defines: [1,49], [50,99], [100,100]
 *
 * intersectingLowerBounds(B, { start: 30, end: 100 });
 * // → [50, 100]
 * ```
 *
 * The function performs binary searches to find the relevant indices efficiently.
 *
 * @param bounds - Sorted array of lower bounds (length ≥ 2)
 * @param range - Object specifying the interval { start, end }
 * @returns Range of indices of in bounds of the intersecting ranges
 */
export function intersectingRanges(bounds: readonly number[], range: Readonly<range>): range {
    const { start, end } = range;
    const n = bounds.length;
    if (n < 2 || start > end) return EmptyRange;

    // Binary search for the first range that might intersect with `start`
    let lo = 0,
        hi = n - 2;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const rStart = bounds[mid]!;
        const rEnd = bounds[mid + 1]! - 1;
        if (rEnd < start) lo = mid + 1;
        else if (rStart > end) hi = mid - 1;
        else hi = mid - 1; // possible overlap, move left to find first
    }
    const first = lo;

    // Binary search for the last range that might intersect with `end`
    lo = 0;
    hi = n - 2;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const rStart = bounds[mid]!;
        const rEnd = bounds[mid + 1]! - 1;
        if (rStart > end) hi = mid - 1;
        else if (rEnd < start) lo = mid + 1;
        else lo = mid + 1; // possible overlap, move right to find last
    }
    const last = hi;

    if (first > last || first >= n - 1) return EmptyRange;

    return R(first, last);
}

/**
 * Build a range
 */
export function R(start: number, end: number): range {
    return { start, end };
}

export const EmptyRange = R(1, 0);

export function assert(expr: boolean, msg: string): asserts expr {
    if (!expr) throw Error('assert failed: ' + msg);
}
