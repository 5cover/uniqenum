import { toBase63 } from './ident.js';
import type { IncludeGuard } from './includeGuards.js';
import type { CodeGenerator, EmitConfig, EmitFn, range } from './types.js';
import { R } from './util.js';
import { FdWriter, LengthWriter } from './writing.js';

const fileSlug = toBase63;

export const emitFile: EmitFn<number> = (cgen, cfg, outFd) => {
    // write to fd
    // generate areuniq xor uniqenum
    // if both are enabled: generate interleaved. this allows knowing when to stop for both at once

    const doAreuniq = +!!cfg.macros.areuniq;
    const doUniqenum = +!!cfg.macros.uniqenum;

    // First pass: generation

    let sizeLimits = Number.isFinite(cfg.maxSize) ? sizingPass(cfg, cgen, doAreuniq, doUniqenum) : undefined;

    const endN = Number.isFinite(cfg.N.end) ? cfg.N.end : sizeLimits!.endN; // asserting !Number.isFinite(cfg.N.end) => Number.isFinite(cfg.maxSize)

    if (Number.isFinite(cfg.N.end) && sizeLimits !== undefined && sizeLimits.totalSize > cfg.maxSize) {
        console.log(
            `warning: generated size will exceed set limit of ${cfg.maxSize} bytes by ${sizeLimits.totalSize - cfg.maxSize} (total ${sizeLimits.totalSize})`
        );
        console.log(`         all macros (from ${cfg.N.start} to ${cfg.N.end}) will still be generated`);
    }

    const w = new FdWriter(outFd);
    let n = cfg.N.start;
    cfg.includeGuard.start(w, fileSlug(endN));
    if (doAreuniq) w.str(cgen.headers.areuniq);
    if (doUniqenum) w.str(cgen.headers.uniqenum);
    while (n++ < endN) {
        if (doAreuniq) cgen.areuniq(w, n);
        if (doUniqenum) cgen.uniqenum(w, n);
    }
    w.str(cfg.includeGuard.end);
    w.flush();
    const r = R(cfg.N.start, endN); // one off since we incremented n in last iteration
    return { areuniq: r, uniqenum: r };
};

export const sizingPass = (cfg: EmitConfig, cgen: CodeGenerator, doAreuniq: number, doUniqenum: number) => {
    let n = cfg.N.start;
    const constSize =
        cfg.includeGuard.end.length +
        doAreuniq * cgen.headers.areuniq.length +
        doUniqenum * cgen.headers.uniqenum.length;
    let macroSize = 0;
    let totalSize = 0;
    while (n <= cfg.N.end && totalSize <= cfg.maxSize) {
        // compute how much budget the next couple will need
        // this runs the generator but does not string concat, thanks to LengthWriter
        macroSize +=
            doAreuniq * LengthWriter.ret(w => cgen.areuniq(w, n)) +
            doUniqenum * LengthWriter.ret(w => cgen.uniqenum(w, n));
        totalSize = LengthWriter.ret(w => cfg.includeGuard.start(w, fileSlug(n))) + macroSize + constSize;
        n++;
    }
    return { endN: n - 2, totalSize };
};
