import type * as fmt from "./format.js";

type FormatMacroName = fmt.Input<'n'>;

/**
 * Configurration names. It's up to you to provide unique names.
 */
export interface CodeConfigNames {
    areuniq: FormatMacroName;
    uniqenum: FormatMacroName;
}

type AssertionCfg<Key extends string, Refs> = {
    when: Key;
    msg: fmt.Input<Refs>;
};

export interface CodeConfig {
    names: CodeConfigNames;
    /**
     * all: generate one static assertion per pair
     * once: generate one static assertion for all pairs
     */
    assert: AssertionCfg<'all', AssertAllRefs> | AssertionCfg<'once', AssertOnceRefs>;
}

export type AssertAllRefs = 'enumerator1' | 'enumerator2';

export type AssertOnceRefs = 'n' | 'name' | 'type';

