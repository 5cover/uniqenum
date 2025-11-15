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

export type AssertAllRefs = 'enumerator1' | 'enumerator2';

export type AssertOnceRefs = 'n' | 'name' | 'type';

export interface GeneratorConfig {
    names: GeneratorConfigNames;
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

export type OutputConfig =
    | { type: 'directory'; path: string; prefixSubdirectoryLength?: number }
    | { type: 'file'; path: string }
    | { type: 'stdout' };

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
    /** Heading code that should start all generated translation units. */
    readonly heading: string;
    /**
     * The header code that must have been included for all macros in each family
     */
    readonly inits: Readonly<Record<MacroFamily, string>>;
    /** Base cases for each macro below which no code is generated */
    readonly bases: Readonly<Record<MacroFamily, number>>;
};
