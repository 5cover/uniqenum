import { createIncludeGuard } from "./includeGuards.js";
import type { GeneratorConfigNames, GeneratorConfigAssert } from "./types.js";

export const DEFAULT_NAMES = {
    areuniq: ['areuniq', { ref: 'n' }],
    uniqenum: ['uniqenum', { ref: 'n' }],
} as const satisfies GeneratorConfigNames;

export const DEFAULT_ASSERTION = {
    when: 'once',
    msg: ['duplicate enum values: ', { ref: 'name' }, ' ', { ref: 'type' }],
} as const satisfies GeneratorConfigAssert;

export const DEFAULT_INCLUDE_GUARD = createIncludeGuard('classic');