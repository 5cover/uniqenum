export interface UniqenumSpec {
    /**
     * Maximum number of enum members to support.
     */
    N: number;
    /**
     * Maximum macro recursive expansion depth.
     */
    D: number;
    /**
     * Maximum "safe" macro arity, used for shared helpers.
     */
    A: number;
}

export const enum GenerationMethod {
    /** Recurse in terms of N-1, adding a row to the right triangle representatio */
    Row,
    /** Recurse in terms of ceil(N/2), splitting the vandermonde in three parts: central near square, and two half as big right triangles */
    Triangle,
    /** Fully expand the vandermonde pairs; no recursion */
    Expanded,
}
