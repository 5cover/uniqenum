import { closeSync, openSync } from 'fs';
import { CCodeGenerator } from './CodeGenerator.js';
import {
    type GeneratorConfigNames,
    type EmitConfig,
    type GenerationSummary,
    type IncludeGuardStrategy,
    type MacroSelectionFlags,
    type OutputConfig,
    type range,
} from './types.js';
import { emitFile } from './FileEmitter.js';
import { emitDirectory } from './DirectoryEmitter.js';
import { createIncludeGuard, type IncludeGuard } from './includeGuards.js';
import {
    DEFAULT_INCLUDE_GUARD,
    DEFAULT_NAMES,
    DEFAULT_PREFIX_SUBDIRECTORY_LENGTH,
} from './const.js';
import { R } from './util.js';

export type { range } from './types.js';
export type { Input as FormatInput } from './format.js';

export type ApiOptions = {
    names?: Partial<GeneratorConfigNames>;
    macros?: Partial<MacroSelectionFlags>;

    maxSize?: number;
    includeGuard?: IncludeGuard | IncludeGuardStrategy;
    N: range | number;

    output: OutputConfig;
};

/**
 *
 * @param o
 * @returns
 */
export function generate(o: ApiOptions): GenerationSummary {
    const cgen = new CCodeGenerator({
        names: {
            areuniq: o.names?.areuniq ?? DEFAULT_NAMES.areuniq,
            uniqenum: o.names?.uniqenum ?? DEFAULT_NAMES.uniqenum,
        },
    });
    const N = validateRange(o.N);
    const maxSize = o.maxSize ?? Infinity;
    if (!Number.isFinite(N.end) && !Number.isFinite(maxSize)) {
        throw new Error('Generating an unbounded flat output requires a finite maxSize limit.');
    }
    const emitCfg: EmitConfig = {
        N,
        maxSize,
        includeGuard:
            typeof o.includeGuard === 'string'
                ? createIncludeGuard(o.includeGuard)
                : (o.includeGuard ?? DEFAULT_INCLUDE_GUARD),
        macros:
            o.macros?.areuniq || o.macros?.uniqenum
                ? {
                      areuniq: o.macros.areuniq,
                      uniqenum: o.macros.uniqenum,
                  }
                : {
                      areuniq: true,
                      uniqenum: true,
                  },
    };
    switch (o.output.type) {
        case 'directory':
            return emitDirectory(cgen, emitCfg, {
                path: o.output.path,
                prefixSubdirectoryLength: o.output.prefixSubdirectoryLength ?? DEFAULT_PREFIX_SUBDIRECTORY_LENGTH,
            });
        case 'file': {
            const fd = openSync(o.output.path, 'w');
            try {
                return emitFile(cgen, emitCfg, fd);
            } finally {
                closeSync(fd);
            }
        }
        case 'stdout':
            return emitFile(cgen, emitCfg, process.stdout.fd);
    }
}

function validateRange(value: range | number): range {
    if (typeof value == 'number') value = R(value, value);
    validatePositiveInteger(value.start, 'range.start');
    if (Number.isFinite(value.end)) validatePositiveInteger(value.end, 'range.end');
    if (value.end < value.start) {
        throw new Error(`range.end (${value.end}) must be >= range.start (${value.start})`);
    }
    return value;
}

function validatePositiveInteger(n: number, label: string): void {
    if (!Number.isFinite(n)) throw new Error(`${label} must be a finite integer`);
    if (!Number.isInteger(n)) throw new Error(`${label} must be an integer`);
    if (n < 0) throw new Error(`${label} must be >= 0`);
}
