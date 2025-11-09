import type { WriteStream } from 'fs';

export type Writer = (str?: string | Teller) => Writer;
export type Teller = (o: Writer) => Writer;

export const join =
    <T>(sep: string, gen: Iterable<T>, prepare: (item: T) => string | Teller): Teller =>
    o => {
        let first = true;
        for (const g of gen) {
            first ? (first = false) : o(sep);
            o(prepare(g));
        }
        return o;
    };

export const stringWriter = (parts: string[]): Writer => {
    const w: Writer = o => (o === undefined ? w : typeof o === 'string' ? (parts.push(o), w) : o(w));
    return w;
};

export const lengthWriter = (result: { length: number }): Writer => {
    const w: Writer = o => (o === undefined ? w : typeof o === 'string' ? ((result.length += o.length), w) : o(w));
    return w;
};

export const logWriter: Writer = o => (o === undefined ? logWriter : typeof o === 'string' ? (console.log('write', o.length, o), logWriter) : o(logWriter));

export const measureLength = (teller: Teller): number => {
    const result = { length: 0 };
    lengthWriter(result)(teller);
    return result.length;
};

/**
 * Writes to a stream
 *
 * @returns The number of bytes written.
 */
export const writeStream = (stream: WriteStream, f: (w: Writer) => void, limit = 8192): number => {
    let pending = 0;
    let total = 0;
    stream.cork();
    const w: Writer = o => {
        if (o === undefined) return w;
        if (typeof o === 'string') {
            stream.write(o);
            pending += o.length;
            if (pending >= limit) {
                stream.uncork();
                stream.cork(); // reopen cork for next batch
                total += pending;
                pending = 0;
            }
            return w;
        }
        return o(w);
    };

    try {
        f(w);
    } finally {
        stream.uncork(); // flush remaining data automatically
        total += pending;
    }
    return total;
};
