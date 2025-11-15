import { createIncludeGuard } from "./includeGuards.js";
import type { GeneratorConfigNames } from "./types.js";

export const DEFAULT_NAMES = {
    areuniq: ['areuniq', { ref: 'n' }],
    uniqenum: ['uniqenum', { ref: 'n' }],
} as const satisfies GeneratorConfigNames;

export const DEFAULT_INCLUDE_GUARD = createIncludeGuard('classic');

export const DEFAULT_PREFIX_SUBDIRECTORY_LENGTH = 2;