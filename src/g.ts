import type { Range } from "./types.js";

export function* combinations(n: number): Generator<[number, number], void, void> {
    for (let i = 0; i < n; ++i) {
        for (let j = i + 1; j < n; ++j) {
            yield [i, j];
        }
    }
}

export function* seq<T>(length: number, map: (i: number) => T): Generator<T, void, void> {
    for (let i = 0; i < length; ++i) yield map(i);
}

export function* range<T>(range: Range): Generator<number, void, void> {
    for (let i = range.start; i < range.end; ++i) yield i;
}

export function reduce<T, TAgg>(gen: Iterable<T>, seed: TAgg, aggregate: (acc: TAgg, item: T) => TAgg) {
    let acc = seed;
    for (const item of gen) {
        acc = aggregate(acc, item);
    }
    return acc;
}
type Wrap<T> = {
    [Key in keyof T]: Iterator<T[Key]>;
};

export function* unzip<Tuple extends unknown[]>(iterators: Wrap<Tuple>): Generator<Tuple, void, void> {
    while (true) {
        const t = [];
        for (const it of iterators) {
            const r = it.next();
            if (r.done) return;
            t.push(r.value);
        }
        yield t as Tuple;
    }
}

export function join<T>(by: string, gen: Iterable<T>): string {
    let s = '';
    for (const item of gen) {
        if (s) s += by;
        s += item;
    }
    return s;
}

export function* of<T>(...items: readonly T[]) {
    for (const item of items) {
        yield item;
    }
}

export function* map<T, U>(gen: Iterable<T>, map: (item: T) => U) {
    for (const item of gen) {
        yield map(item);
    }
}

export function* cat<T>(...gens: Iterable<T>[]) {
    for (const gen of gens) {
        for (const item of gen) {
            yield item;
        }
    }
}
