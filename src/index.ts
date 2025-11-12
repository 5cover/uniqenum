import path from 'path';
import { closeSync, mkdirSync, openSync } from 'fs';
import { C11CodeGenerator } from './CodeGenerator.js';
import type { CodeConfig, CodeConfigNames } from './CodeConfig.js';
import type { range } from './types.js';
import {
    FilesWriter,
    type IncludeGuardStrategy,
    type FilesWriterSelection,
    type FilesWriterResult,
    createIncludeGuard,
} from './writer.js';
import { FdWriter, type Writer } from './writing.js';

export type { range } from './types.js';
export type { CodeConfigNames, AssertAllRefs, AssertOnceRefs } from './CodeConfig.js';
export type { IncludeGuardStrategy } from './writer.js';
export type { Input as FormatInput } from './format.js';

const DEFAULT_NAMES: CodeConfigNames = {
    areuniq: ['areuniq', { ref: 'n' }],
    uniqenum: ['uniqenum', { ref: 'n' }],
};

const DEFAULT_ASSERTION: CodeConfig['assert'] = {
    when: 'once',
    msg: ['duplicate enum values: ', { ref: 'name' }, ' ', { ref: 'type' }],
};

const DEFAULT_INCLUDE_GUARD: IncludeGuardStrategy = 'classic';

export const DEFAULT_MAX_FILE_SIZE = 256 * 1024;

export type MacroFamily = 'areuniq' | 'uniqenum';

export type MacroSelectionOption = MacroFamily | MacroFamily[] | Partial<Record<MacroFamily, boolean>>;

export type DependencyStrategy = 'include' | 'omit';

export interface GenerateOptions {
    range: number | range;
    /**
     * Macro families to emit. Defaults to both.
     */
    macros?: MacroSelectionOption;
    /**
     * Whether uniqenum output should automatically emit its areuniq dependencies.
     * Defaults to 'include'.
     */
    dependencies?: DependencyStrategy;
    output: OutputTargetOptions;
    names?: Partial<CodeConfigNames>;
    assert?: CodeConfig['assert'];
}

export type OutputTargetOptions = StdoutOutput | FileOutput | DirectoryOutput;

interface BaseOutput {
    includeGuards?: IncludeGuardStrategy;
}

export interface StdoutOutput extends BaseOutput {
    kind: 'stdout';
}

export interface FileOutput extends BaseOutput {
    kind: 'file';
    path: string;
}

export interface DirectoryOutput extends BaseOutput {
    kind: 'directory';
    path: string;
    maxFileSize?: number;
}

export interface GeneratedRange {
    start: number;
    end: number;
}

export interface GenerationSummary {
    areuniq?: GeneratedRange;
    uniqenum?: GeneratedRange;
}

interface MacroSelectionFlags {
    areuniq: boolean;
    uniqenum: boolean;
}

const MacroFamilies: readonly MacroFamily[] = ['areuniq', 'uniqenum'] as const;

export function generate(options: GenerateOptions): GenerationSummary {
    const normalizedRange = normalizeRange(options.range);
    const dependencies = options.dependencies ?? 'include';
    const selection = applyDependencyPolicy(normalizeMacroSelection(options.macros), dependencies);
    const cfg = buildCodeConfig(options);
    const generator = new C11CodeGenerator(cfg);

    if (options.output.kind === 'directory') {
        return writeDirectory(generator, selection, normalizedRange, options.output);
    }

    ensureFiniteRange(normalizedRange, options.output.kind);
    return writeFlat(generator, selection, normalizedRange, options.output);
}

function buildCodeConfig(options: GenerateOptions): CodeConfig {
    return {
        names: {
            areuniq: options.names?.areuniq ?? DEFAULT_NAMES.areuniq,
            uniqenum: options.names?.uniqenum ?? DEFAULT_NAMES.uniqenum,
        },
        assert: options.assert ?? DEFAULT_ASSERTION,
    };
}

function writeDirectory(
    generator: C11CodeGenerator,
    selection: MacroSelectionFlags,
    normalizedRange: range,
    target: DirectoryOutput
): GenerationSummary {
    const writer = new FilesWriter(generator, {
        maxFileSize: target.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
        outputDir: path.resolve(target.path),
        includeGuards: target.includeGuards ?? DEFAULT_INCLUDE_GUARD,
        N: normalizedRange,
    });

    const result = writer.generate(selection as FilesWriterSelection);
    return {
        areuniq: result.areuniq && clampGeneratedRange(result.areuniq, 2),
        uniqenum: result.uniqenum && clampGeneratedRange(result.uniqenum, 1),
    };
}

function writeFlat(
    generator: C11CodeGenerator,
    selection: MacroSelectionFlags,
    normalizedRange: range,
    target: StdoutOutput | FileOutput
): GenerationSummary {
    const guard = createIncludeGuard(target.includeGuards ?? DEFAULT_INCLUDE_GUARD);
    const write = (writer: Writer) => {
        guard.start(writer, 0);
        const summary = emitSequential(generator, selection, normalizedRange, writer);
        writer.str(guard.end);
        return summary;
    };

    if (target.kind === 'stdout') {
        return write(new FdWriter(process.stdout.fd));
    }

    mkdirSync(path.dirname(target.path), { recursive: true });
    const fd = openSync(target.path, 'w');
    try {
        return write(new FdWriter(fd));
    } finally {
        closeSync(fd);
    }
}

function emitSequential(
    generator: C11CodeGenerator,
    selection: MacroSelectionFlags,
    normalizedRange: range,
    writer: Writer
): GenerationSummary {
    const summary: GenerationSummary = {};

    if (selection.areuniq) {
        const range = emitFamily(normalizedRange, 2, n => generator.areuniq(writer, n));
        if (range) summary.areuniq = range;
    }

    if (selection.uniqenum) {
        const range = emitFamily(normalizedRange, 1, n => generator.uniqenum(writer, n));
        if (range) summary.uniqenum = range;
    }

    return summary;
}

function emitFamily(src: range, minN: number, emit: (n: number) => void): GeneratedRange | undefined {
    const start = Math.max(src.start, minN);
    if (start > src.end) return undefined;
    for (let n = start; n <= src.end; ++n) emit(n);
    return { start, end: src.end };
}

function normalizeRange(value: number | range): range {
    if (typeof value === 'number') {
        const n = ensureInteger(value, 'range');
        return { start: n, end: n };
    }
    const start = ensureInteger(value.start, 'range.start');
    const end = value.end === Infinity ? Infinity : ensureInteger(value.end, 'range.end');
    if (end < start) {
        throw new Error(`range.end (${value.end}) must be >= range.start (${value.start})`);
    }
    return { start, end };
}

function ensureInteger(n: number, label: string): number {
    if (!Number.isFinite(n)) throw new Error(`${label} must be a finite integer`);
    if (!Number.isInteger(n)) throw new Error(`${label} must be an integer`);
    if (n < 0) throw new Error(`${label} must be >= 0`);
    return n;
}

function normalizeMacroSelection(option?: MacroSelectionOption): MacroSelectionFlags {
    if (!option) return { areuniq: true, uniqenum: true };
    if (typeof option === 'string') {
        return normalizeMacroSelection([option]);
    }
    if (Array.isArray(option)) {
        const flags: MacroSelectionFlags = { areuniq: false, uniqenum: false };
        for (const entry of option) {
            if (!isMacroFamily(entry)) throw new Error(`Unknown macro family: ${entry}`);
            flags[entry] = true;
        }
        if (!flags.areuniq && !flags.uniqenum) throw new Error('At least one macro family must be selected');
        return flags;
    }
    const flags: MacroSelectionFlags = {
        areuniq: Boolean(option.areuniq),
        uniqenum: Boolean(option.uniqenum),
    };
    if (!flags.areuniq && !flags.uniqenum) throw new Error('At least one macro family must be selected');
    return flags;
}

function applyDependencyPolicy(selection: MacroSelectionFlags, deps: DependencyStrategy): MacroSelectionFlags {
    if (deps === 'include' && selection.uniqenum && !selection.areuniq) {
        return { ...selection, areuniq: true };
    }
    return selection;
}

function ensureFiniteRange(rng: range, target: 'stdout' | 'file') {
    if (!Number.isFinite(rng.end)) {
        throw new Error(`Output target "${target}" requires a finite range end`);
    }
}

function isMacroFamily(value: string): value is MacroFamily {
    return (MacroFamilies as readonly string[]).includes(value);
}

function clampGeneratedRange(range: FilesWriterResult['areuniq'], minN: number): GeneratedRange | undefined {
    if (!range) return undefined;
    const start = Math.max(range.start, minN);
    if (start > range.end) return undefined;
    return { start, end: range.end };
}
