import type { CStringBuilder } from './CStringBuilder.js';
import type { IdentFn } from './ident.js';
import * as g from './g.js';
/**
 * Configurration names. It's up to you to provide unique names.
 */
export interface CodeConfigNames {
    areuniq: (n: number) => string;
    uniqenum: (n: number) => string;
}

type AssertionCfg<Key extends string, T> = {
    when: Key;
    msg: (builder: CStringBuilder, data: T) => CStringBuilder;
};

export interface CodeConfig {
    names: CodeConfigNames;
    /**
     * all: generate one static assertion per pair
     * once: generate one static assertion for all pairs
     */
    assert: AssertionCfg<'all', AssertAllInfo> | AssertionCfg<'once', AssertOnceInfo>;
}

export interface AssertAllInfo {
    enumerator1: string;
    enumerator2: string;
}

export class AssertOnceInfo {
    constructor(
        readonly n: number,
        private readonly ident: IdentFn
    ) {}

    get name() {
        return this.ident(2 * this.n + 1);
    }

    get type() {
        return this.ident(2 * (this.n + 1));
    }

    values() {
        return g.seq(this.n, i => this.ident(this.n + i));
    }

    keys() {
        return g.seq(this.n, this.ident);
    }

    *params() {
        yield this.name;
        for (const p of g.seq(2 * this.n, i => this.ident(Math.trunc(i / 2) + +(i % 2) * this.n))) {
            yield p;
        }
        yield this.type;
    }
}
