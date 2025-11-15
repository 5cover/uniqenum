import { program } from '@commander-js/extra-typings';
import { generate } from './index.js';
import { safeParseInt, throwf } from './util.js';
import {
    IncludeGuardStrategies,
    isIncludeGuardStrategy,
    type IncludeGuardStrategy,
    type OutputConfig,
} from './types.js';

type CliOptions = {
    areuniq?: boolean;
    uniqenum?: boolean;
    output?: string;
    asdir?: boolean;
    guard: IncludeGuardStrategy;
    maxSize?: number;
};

program
    .name('uniqenum')
    .description('Unique enum C meta-programming macro family generator.')
    .argument('<Nstart>', 'Start of N range (or the single N if Nend is omitted)')
    .argument('[Nend]', 'End of N range (inclusive)')
    .option('--areuniq', 'Emit only the areuniq macro family')
    .option('--uniqenum', 'Emit only the uniqenum macro family')
    .option('-o, --output <path>', 'Write to a single header file')
    .option('-d, --asdir', 'Treat output as directory')
    .option('-l, --max-size <bytes>', 'Maximum bytes per output file (flat or directory)', parsePositiveInt)
    .option('-g, --guard <style>', `Include guard style: ${IncludeGuardStrategies.join(' | ')}`, parseGuard, 'classic')
    .action(
        (startArg, endArg, opts: CliOptions) =>
            void generate({
                N: buildRange(startArg, endArg),
                output: resolveOutput(opts),
                maxSize: opts.maxSize,
                includeGuard: opts.guard,
                macros: {
                    areuniq: opts.areuniq,
                    uniqenum: opts.uniqenum,
                },
            })
    );

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

function resolveOutput(opts: CliOptions): OutputConfig {
    if (opts.asdir) {
        return {
            type: 'directory',
            path: opts.output ?? throwf(new Error('Please specify an output directory via the --output option')),
        };
    }

    if (opts.output !== undefined) {
        return {
            type: 'file',
            path: opts.output,
        };
    }

    return { type: 'stdout' };
}

function parsePositiveInt(value: string): number {
    const parsed = safeParseInt(value);
    if (parsed === null || parsed <= 0) {
        throwf(new Error(`Expected a positive integer, got: ${value}`));
    }
    return parsed;
}

function parseFiniteInt(value: string, label: string): number {
    return safeParseInt(value) ?? throwf(new Error(`${label} must be an integer, got: ${value}`));
}

function parseRangeEnd(value: string): number {
    if (isInfinityToken(value)) return Infinity;
    const parsed = safeParseInt(value);
    return parsed ?? throwf(new Error(`Nend must be an integer or "inf", got: ${value}`));
}

function parseGuard(value: string): IncludeGuardStrategy {
    if (isIncludeGuardStrategy(value)) return value;
    throw new Error(`Unknown guard style: ${value}`);
}

function isInfinityToken(value: string) {
    const normalized = value.toLowerCase();
    return normalized === 'inf' || normalized === 'infinity';
}
