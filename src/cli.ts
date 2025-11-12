import { program } from '@commander-js/extra-typings';
import {
    DEFAULT_MAX_FILE_SIZE,
    generate,
    type DependencyStrategy,
    type IncludeGuardStrategy,
    type MacroFamily,
    type OutputTargetOptions,
} from './index.js';
import { safeParseInt, throwf } from './util.js';

type CliOptions = {
    areuniq?: boolean;
    uniqenum?: boolean;
    deps: boolean;
    outFile?: string;
    outDir?: string;
    guard: IncludeGuardStrategy;
    maxSize: number;
};

program
    .name('uniqenum')
    .description('Unique enum C meta-programming macro family generator.')
    .argument('<Nstart>', 'Start of N range (or the single N if Nend is omitted)')
    .argument('[Nend]', 'End of N range (inclusive)')
    .option('--areuniq', 'Emit only the areuniq macro family')
    .option('--uniqenum', 'Emit only the uniqenum macro family')
    .option('--no-deps', 'Do not emit areuniq dependencies when uniqenum is selected')
    .option('-o, --out-file <path>', 'Write to a single header file')
    .option('-d, --out-dir <path>', 'Write headers into a sharded directory')
    .option(
        '--max-size <bytes>',
        'Maximum size per generated file when using --out-dir',
        parsePositiveInt,
        DEFAULT_MAX_FILE_SIZE
    )
    .option('-g, --guard <style>', 'Include guard style: classic | pragmaOnce | omit', parseGuard, 'classic')
    .action((startArg, endArg, opts: CliOptions) => {
        const range = buildRange(startArg, endArg);
        const macros = resolveMacroSelection(opts);
        const dependencies: DependencyStrategy = opts.deps ? 'include' : 'omit';
        const output = resolveOutput(opts);

        generate({
            range,
            macros,
            dependencies,
            output,
        });
    });

program.parse();

function buildRange(startArg: string, endArg?: string) {
    const start = parseFiniteInt(startArg, 'Nstart');
    const endValue = endArg ?? startArg;
    const end = parseRangeEnd(endValue);
    if (Number.isFinite(end) && end < start) {
        throw new Error(`Nend (${end}) must be >= Nstart (${start})`);
    }
    return { start, end };
}

function resolveMacroSelection(opts: Pick<CliOptions, 'areuniq' | 'uniqenum'>): MacroFamily[] | undefined {
    const requested: MacroFamily[] = [];
    if (opts.areuniq) requested.push('areuniq');
    if (opts.uniqenum) requested.push('uniqenum');
    if (!requested.length) return undefined;
    return requested;
}

function resolveOutput(opts: Pick<CliOptions, 'outFile' | 'outDir' | 'guard' | 'maxSize'>): OutputTargetOptions {
    const targets = [opts.outFile, opts.outDir].filter(Boolean);
    if (targets.length > 1) {
        throw new Error('Please specify only one of --out-file or --out-dir');
    }

    if (opts.outDir) {
        return {
            kind: 'directory',
            path: opts.outDir,
            maxFileSize: opts.maxSize,
            includeGuards: opts.guard,
        };
    }

    if (opts.outFile) {
        return {
            kind: 'file',
            path: opts.outFile,
            includeGuards: opts.guard,
        };
    }

    return { kind: 'stdout', includeGuards: opts.guard };
}

function parsePositiveInt(value: string): number {
    const parsed = safeParseInt(value);
    if (parsed === null || parsed <= 0) {
        throwf(new Error(`Expected a positive integer, got: ${value}`));
    }
    return parsed;
}

function parseFiniteInt(value: string, label: string): number {
    const parsed = safeParseInt(value);
    if (parsed === null) throwf(new Error(`${label} must be an integer, got: ${value}`));
    return parsed;
}

function parseRangeEnd(value: string): number {
    if (isInfinityToken(value)) return Infinity;
    const parsed = safeParseInt(value);
    if (parsed === null) throwf(new Error(`Nend must be an integer or "inf", got: ${value}`));
    return parsed;
}

function parseGuard(value: string): IncludeGuardStrategy {
    switch (value) {
        case 'classic':
        case 'pragmaOnce':
        case 'omit':
            return value;
        default:
            throw new Error(`Unknown guard style: ${value}`);
    }
}

function isInfinityToken(value: string) {
    const normalized = value.toLowerCase();
    return normalized === 'inf' || normalized === 'infinity';
}
