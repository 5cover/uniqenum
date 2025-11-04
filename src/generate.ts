import { C11CodeGenerator } from "./CodeGenerator.js";
import { AlwaysAlgortihm, HighwayRecursionAlgorithm } from "./RecursionAlgorithm.js";
import { GenerationMethod, type UniqenumSpec } from "./types.js";
import type { CodeWriter } from "./writer.js";

export function generateUniqenum(spec: Readonly<UniqenumSpec>, writer: CodeWriter): void {
    const generator = new C11CodeGenerator();
    for (let n = 1; n <= spec.N; ++n) {
        writer.addCode(generator.uniqenum(n));
    }
    writer.flush();
}