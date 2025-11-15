import type * as fmt from './format.js';
import type { IncludeGuard } from './includeGuards.js';
import type { Writer } from './writing.js';

export interface range {
    /**
     * N start boundary, inclusive
     */
    start: number;
    /**
     * N end boundary, inclusive
     */
    end: number;
}

export const MacroFamilies = ['areuniq', 'uniqenum'] as const;
export type MacroFamily = (typeof MacroFamilies)[number];
export const isMacroFamily = (value: string): value is MacroFamily =>
    (MacroFamilies as readonly string[]).includes(value);
export const IncludeGuardStrategies = ['omit', 'pragmaOnce', 'classic'] as const;
export type IncludeGuardStrategy = (typeof IncludeGuardStrategies)[number];
export const isIncludeGuardStrategy = (value: string): value is IncludeGuardStrategy =>
    (IncludeGuardStrategies as readonly string[]).includes(value);

type FormatMacroName = fmt.Input<'n'>;

/**
 * Configuration names. It's up to you to provide unique names.
 */
export type GeneratorConfigNames = Record<MacroFamily, FormatMacroName>;
export type GeneratorConfigAssert = AssertionCfg<'all', AssertAllRefs> | AssertionCfg<'once', AssertOnceRefs>;

type AssertionCfg<Key extends string, Refs> = {
    when: Key;
    msg: fmt.Input<Refs>;
};

export type AssertAllRefs = 'enumerator1' | 'enumerator2';

export type AssertOnceRefs = 'n' | 'name' | 'type';

export interface GenerateConfig {
    names: GeneratorConfigNames;
    assert: GeneratorConfigAssert;
}

export interface EmitConfig {
    /**
     * Macro families to emit. Defaults to both.
     */
    macros: MacroSelectionFlags;
    maxSize: number;
    includeGuard: IncludeGuard;
    N: range;
}

export type OutputConfig = { type: 'directory' | 'file'; path: string } | { type: 'stdout' };

export type GenerationSummary = Record<MacroFamily, range>;
export type MacroSelectionFlags = Partial<Record<MacroFamily, boolean>>;

export type EmitFn<T> = (cgen: CodeGenerator, cfg: EmitConfig, arg: T) => GenerationSummary;

/**
 * Macro generator.
 * For each generator f:
 * Invariant: f(n + m) >= f(n)
 * Invariant: f(n) is pure
 */
export type CodeGenerator = Readonly<Record<MacroFamily, (w: Writer, n: number) => Writer>> & {
    /**
     * For each macro family, this number represent the largest N that generates a self contained macro, without dependencies.
     */
    readonly bases: Readonly<Record<MacroFamily, number>>;
};
