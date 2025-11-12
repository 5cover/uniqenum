import path from 'path';
import { closeSync, mkdirSync, openSync } from 'fs';
import { C11CodeGenerator } from './CodeGenerator.js';
import type { CodeConfig, CodeConfigNames } from './CodeConfig.js';
import type { range } from './types.js';
import { FilesWriter, type IncludeGuardStrategy, type FilesWriterResult, createIncludeGuard } from './writer.js';
import { FdWriter, LengthWriter, type Writer } from './writing.js';

export type { range } from './types.js';
export type { CodeConfigNames, AssertAllRefs, AssertOnceRefs } from './CodeConfig.js';
export type { IncludeGuardStrategy } from './writer.js';
export type { Input as FormatInput } from './format.js';

const DEFAULT_NAMES = {
    areuniq: ['areuniq', { ref: 'n' }],
    uniqenum: ['uniqenum', { ref: 'n' }],
} as const satisfies CodeConfigNames;

const DEFAULT_ASSERTION = {
    when: 'once',
    msg: ['duplicate enum values: ', { ref: 'name' }, ' ', { ref: 'type' }],
} as const satisfies CodeConfig['assert'];

const DEFAULT_INCLUDE_GUARD = 'classic' satisfies IncludeGuardStrategy;

export const DEFAULT_MAX_FILE_SIZE = 256 * 1024;

const MacroFamilies = ['areuniq', 'uniqenum'] as const;
export type MacroFamily = (typeof MacroFamilies)[number];

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

interface FlatOutput extends BaseOutput {
    maxBytes?: number;
}

export interface StdoutOutput extends FlatOutput {
    kind: 'stdout';
}

export interface FileOutput extends FlatOutput {
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

interface MacroEmission {
    kind: MacroFamily;
    n: number;
    len: number;
    emit: () => void;
}

interface SizeTracker {
    value: number;
}

export function generate(options: GenerateOptions): GenerationSummary {
    const normalizedRange = normalizeRange(options.range);
    const dependencies = options.dependencies ?? 'include';
    const selection = applyDependencyPolicy(normalizeMacroSelection(options.macros), dependencies);
    const cfg = buildCodeConfig(options);
    const generator = new C11CodeGenerator(cfg);

    if (options.output.kind === 'directory') {
        return writeDirectory(generator, selection, normalizedRange, options.output);
    }
    
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

    const result = writer.generate(selection);
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
    const guardStartLen = LengthWriter.ret(guard.start, 0);
    const guardEndLen = guard.end.length;
    const maxBytes = target.maxBytes ?? Infinity;

    if (!Number.isFinite(normalizedRange.end) && !Number.isFinite(maxBytes)) {
        throw new Error('Generating an unbounded flat output requires a finite maxBytes limit.');
    }

    const sizeTracker: SizeTracker = { value: guardStartLen };

    const emitTo = (writer: Writer) => {
        guard.start(writer, 0);
        const summary = emitSequentialLimited(
            generator,
            selection,
            normalizedRange,
            writer,
            guardEndLen,
            maxBytes,
            sizeTracker
        );
        writer.str(guard.end);
        sizeTracker.value += guardEndLen;

        if (Number.isFinite(normalizedRange.end) && sizeTracker.value > maxBytes) {
            const excess = Math.trunc(sizeTracker.value - maxBytes);
            if (excess > 0) console.warn(`Warning: flat output exceeded max size by ${excess} bytes.`);
        }
        return summary;
    };

    if (target.kind === 'stdout') {
        return emitTo(new FdWriter(process.stdout.fd));
    }

    mkdirSync(path.dirname(target.path), { recursive: true });
    const fd = openSync(target.path, 'w');
    try {
        return emitTo(new FdWriter(fd));
    } finally {
        closeSync(fd);
    }
}

function emitSequentialLimited(
    generator: C11CodeGenerator,
    selection: MacroSelectionFlags,
    normalizedRange: range,
    writer: Writer,
    guardEndLen: number,
    maxBytes: number,
    sizeTracker: SizeTracker
): GenerationSummary {
    if (selection.areuniq && selection.uniqenum) {
        return emitPairedFamilies(generator, normalizedRange, writer, guardEndLen, maxBytes, sizeTracker);
    }

    const summary: GenerationSummary = {};

    if (selection.areuniq) {
        summary.areuniq = emitSoloFamily(
            'areuniq',
            normalizedRange,
            2,
            (w, n) => generator.areuniq(w, n),
            writer,
            guardEndLen,
            maxBytes,
            sizeTracker
        );
    }

    if (selection.uniqenum) {
        summary.uniqenum = emitSoloFamily(
            'uniqenum',
            normalizedRange,
            1,
            (w, n) => generator.uniqenum(w, n),
            writer,
            guardEndLen,
            maxBytes,
            sizeTracker
        );
    }

    return summary;
}

function emitSoloFamily(
    kind: MacroFamily,
    src: range,
    minN: number,
    emitFn: (writer: Writer, n: number) => Writer,
    writer: Writer,
    guardEndLen: number,
    maxBytes: number,
    sizeTracker: SizeTracker
): GeneratedRange | undefined {
    const start = Math.max(src.start, minN);
    const infinite = !Number.isFinite(src.end);
    if (!infinite && start > src.end) return undefined;

    let rangeOut: GeneratedRange | undefined;
    for (let n = start; infinite || n <= src.end; ++n) {
        const len = LengthWriter.ret(w => emitFn(w, n));
        const predicted = sizeTracker.value + len + guardEndLen;
        if (predicted > maxBytes && infinite) break;
        emitFn(writer, n);
        sizeTracker.value += len;
        rangeOut = extendRange(rangeOut, n);
        if (!infinite && n === src.end) break;
    }
    return rangeOut;
}

function emitPairedFamilies(
    generator: C11CodeGenerator,
    src: range,
    writer: Writer,
    guardEndLen: number,
    maxBytes: number,
    sizeTracker: SizeTracker
): GenerationSummary {
    const summary: GenerationSummary = {};
    const infinite = !Number.isFinite(src.end);

    for (let n = src.start; infinite || n <= src.end; ++n) {
        const macros: MacroEmission[] = [];

        const emitAreuniq = n >= 2;
        if (emitAreuniq) {
            const len = LengthWriter.ret(w => generator.areuniq(w, n));
            macros.push({
                kind: 'areuniq',
                n,
                len,
                emit: () => generator.areuniq(writer, n),
            });
        }

        const canEmitUniqenum = n >= 1 && (n < 2 || emitAreuniq);
        if (canEmitUniqenum) {
            const len = LengthWriter.ret(w => generator.uniqenum(w, n));
            macros.push({
                kind: 'uniqenum',
                n,
                len,
                emit: () => generator.uniqenum(writer, n),
            });
        }

        if (!macros.length) {
            if (!infinite && n === src.end) break;
            continue;
        }

        const totalLen = macros.reduce((acc, m) => acc + m.len, 0);
        const predicted = sizeTracker.value + totalLen + guardEndLen;
        if (predicted > maxBytes && infinite) break;

        for (const macro of macros) {
            macro.emit();
            sizeTracker.value += macro.len;
            if (macro.kind === 'areuniq') summary.areuniq = extendRange(summary.areuniq, macro.n);
            else summary.uniqenum = extendRange(summary.uniqenum, macro.n);
        }

        if (!infinite && n === src.end) break;
    }

    return summary;
}

function extendRange(range: GeneratedRange | undefined, n: number): GeneratedRange {
    if (!range) return { start: n, end: n };
    return { start: range.start, end: n };
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

function isMacroFamily(value: string): value is MacroFamily {
    return (MacroFamilies as readonly string[]).includes(value);
}

function clampGeneratedRange(range: FilesWriterResult['areuniq'], minN: number): GeneratedRange | undefined {
    if (!range) return undefined;
    const start = Math.max(range.start, minN);
    if (start > range.end) return undefined;
    return { start, end: range.end };
}
