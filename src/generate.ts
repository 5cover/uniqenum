import { C11CodeGenerator } from "./CodeGenerator.js";
import { AlwaysAlgortihm, HighwayRecursionAlgorithm } from "./RecursionAlgorithm.js";
import { GenerationMethod, type UniqenumSpec } from "./types.js";
import type { CodeWriter } from "./writer.js";

export function generateUniqenum(spec: Readonly<UniqenumSpec>, writer: CodeWriter): void {
    const recursor = new AlwaysAlgortihm(GenerationMethod.Expanded);
    const generator = new C11CodeGenerator();
    writer.addCode(generator.generateMacro1());
    console.log(spec.N)
    for (let n = 2; n <= spec.N; ++n) {
        writer.addCode(generator.generateMacro(recursor.getRercursionMethod(n), n));
    }
    writer.flush();
}