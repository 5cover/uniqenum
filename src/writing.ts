import type { WriteStream } from 'fs';

type Falsey = undefined | null | false;

export type Teller<TArgs extends unknown[] = never[]> = (w: Writer, ...args: TArgs) => void;

export abstract class Writer<T = unknown> {
    /** Write a string literal. Do not call this method with concatenanted/sliced strings to preserve performance */
    abstract str(s: Falsey | string): this;
    /** Write an integer number in base 10. */
    abstract int(n: number): this;
    /** Appends the previously written code. */
    abstract use(saved: T): this;
    /** Call a function that uses a writer with this writer, but also returns the newly written code. Use this for small to medium content where it's worth more to hold it in memory than to compute it again. */
    abstract save<TArgs extends unknown[]>(f: Teller<TArgs>, ...args: TArgs): T;
    /**
     * Write a sequence of elements, separated by `sep`.
     * Each element is processed by `f`, which receives the writer and the element.
     */
    join<TItem>(sep: Falsey | string, items: Iterable<TItem>, f?: Teller<[item: TItem, index: number]>): this {
        let first = true;
        let i = 0;
        for (const x of items) {
            if (first) {
                first = false;
            } else if (sep) this.str(sep);
            if (f) f(this, x, i++);
            else this.str(String(x));
        }
        return this;
    }
}

export class StringWriter extends Writer<string> {
    private buf: string[] = [];
    private buf2?: string[];
    reset() {
        if (this.buf.length) this.buf = [];
        this.buf2 = undefined;
        return this;
    }

    private static readonly static = new StringWriter();
    static ret<TArgs extends unknown[]>(f: Teller<TArgs>, ...args: TArgs): string {
        f?.(StringWriter.static, ...args)
        const s = StringWriter.static.toString();
        StringWriter.static.reset();
        return s;
    }

    override save<TArgs extends unknown[]>(f: Teller<TArgs>, ...args: TArgs): string {
        this.buf2 = [];
        f(this, ...args);
        let r: string;
        // prettier-ignore
        switch (this.buf2.length) {
            case 0: r = ''
            break; case 1: r = this.buf2[0]!;
            break; default: r = this.buf2.join('');
        }
        this.buf2 = undefined;
        return r;
    }

    override use(saved: string): this {
        return this.str(saved);
    }

    override toString() {
        return this.buf.join('');
    }
    override str(s: Falsey | string) {
        if (s) {
            this.buf.push(s);
            this.buf2?.push(s);
        }
        return this;
    }
    override int(n: number) {
        return this.str(Math.trunc(n).toString());
    }
}

export class LengthWriter extends Writer<number> {
    private len = 0;
    get length() {
        return this.len;
    }
    reset() {
        this.len = 0;
    }

    private static readonly static = new LengthWriter();
    static ret<TArgs extends unknown[]>(f: Teller<TArgs>, ...args: TArgs): number {
        f(LengthWriter.static, ...args);
        const l = LengthWriter.static.len;
        LengthWriter.static.reset();
        return l;
    }

    override save<TArgs extends unknown[]>(f: Teller<TArgs>, ...args: TArgs): number {
        let lenBefore = this.len;
        f(this, ...args);
        return this.len - lenBefore;
    }

    override use(saved: number): this {
        this.len += saved;
        return this;
    }

    override str(str: Falsey | string) {
        if (str) this.len += str.length;
        return this;
    }
    override int(n: number) {
        this.len += isFinite(n) ? +(n < 0) + 1 + Math.floor(Math.log10(Math.abs(n))) : n.toString().length;
        return this;
    }
}

export class StreamWriter extends Writer<string> {
    constructor(
        private readonly stream: WriteStream,
        private readonly cfg: { flushEvery?: number; end?: boolean } = {}
    ) {
        super();
        this.limit = cfg.flushEvery ?? Infinity;
    }
    private readonly limit: number;
    private pending = 0;
    private total = 0;
    
    private corked = false;
    private saved?: string[];

    override int(n: number): this {
        return this.write(Math.trunc(n).toString());
    }
    override str(s: string | undefined | null): this {
        return s ? this.write(s) : this;
    }

    get bytesWritten() {
        return this.total;
    }

    override save<TArgs extends unknown[]>(f: Teller<TArgs>, ...args: TArgs): string {
        this.saved = [];
        f(this, ...args);
        let r: string;
        switch (this.saved.length) {
            case 0:
                r = '';
                break;
            case 1:
                r = this.saved[0]!;
                break;
            default:
                r = this.saved.join('');
        }
        this.saved = undefined;
        return r;
    }

    override use(saved: string): this {
        return this.write(saved);
    }

    private write(s: string): this {
        this.saved?.push(s);
        if (isFinite(this.limit)) this.ensureCorked();
        this.stream.write(s);
        this.pending += s.length;
        this.total += s.length;
        if (this.pending >= this.limit) {
            this.pending = 0;
            this.stream.uncork();
            this.corked = false;
            setImmediate(this.ensureCorked);
        }
        return this;
    }

    end(): void {
        if (this.corked) this.stream.uncork();
        if (this.cfg.end) this.stream.end();
    }

    readonly ensureCorked = () => {
        if (!this.corked) {
            this.stream.cork();
            this.corked = true;
        }
    };
}
