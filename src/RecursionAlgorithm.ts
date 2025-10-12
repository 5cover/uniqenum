/**
 * Recursion module.
 * Decides which recursion method to use, for which N
 */

import { GenerationMethod, type UniqenumSpec } from "./types.js";

export interface RecursionAlgorithm {
    getRercursionMethod(n: number): GenerationMethod;
}

export class HighwayRecursionAlgorithm implements RecursionAlgorithm
{
    private readonly h: Set<number>;
    constructor(spec: Readonly<UniqenumSpec>) {
        this.h = getHighwayNvalues(spec);
    }

    getRercursionMethod(n: number): GenerationMethod {
        return this.h.has(n) ? GenerationMethod.Row : GenerationMethod.Triangle;
    }
}

export class AlwaysAlgortihm implements RecursionAlgorithm
{
    constructor(private readonly method: GenerationMethod) {

    }

    getRercursionMethod(n: number): GenerationMethod {
        return this.method;
    }
}


/** Solve the problem.
Prints values of N to places highways on (unsorted, duplicates allowed).
Returns the set of n values to place an highway on.
*/
function getHighwayNvalues(spec: Readonly<UniqenumSpec>) {
    const h = new Set<number>();
    let d_furthest_highway = 0;
    let d = 0;
    for (let n = 2; n <= spec.N; ++n) {
        if (d + d_furthest_highway == spec.D) {
            // Only place highways on even numbers, to avoid the max problem
            let m = n;
            do {
                h.add(m);
                m >>= 1;
            } while (m > 2 && m % 2 == 0 && !h.has(m));
            d_furthest_highway = distance(h, n);
            d = 0;
        } else {
            d++;
        }
    }
    return h;
}

function distance(h: Set<number>, n: number): number {
    if (n <= 2) return 0;
    if (h.has(n)) {
        const dHalf = distance(h, n >> 1);
        return 1 + (n % 2 ? Math.max(dHalf, distance(h, (n >> 1) + 1)) : dHalf);
    } else {
        return 1 + distance(h, n - 1);
    }
}
