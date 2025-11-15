import type { IncludeGuardStrategy } from "./types.js";
import type { Writer } from "./writing.js";

export interface IncludeGuard {
    start: (writer: Writer, fileSlug: string) => Writer;
    end: string;
}

export function createIncludeGuard(strat: IncludeGuardStrategy): IncludeGuard {
    switch (strat) {
        case 'classic':
            return {
                end: '#endif\n',
                start: (w, fileSlug) => {
                    const guardMacro = `UNIQ_${fileSlug}_H\n`;
                    return w.str('#ifndef ').str(guardMacro).str('#define ').str(guardMacro);
                },
            };
        case 'omit':
            return {
                start: w => w,
                end: '',
            };
        case 'pragmaOnce': {
            return {
                start: w => w.str('#pragma once\n'),
                end: '',
            };
        }
    }
}
