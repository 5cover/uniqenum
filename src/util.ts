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