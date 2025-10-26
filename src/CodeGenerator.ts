import { GenerationMethod } from "./types.js";
import { combinations, ident } from "./util.js";

export interface CodeGenerator {
    /**
     * Special case: only one value, no duplicate assertion
     */
    generateMacro1(): string;
    generateMacro(method: GenerationMethod, n: number): string;
}

export class C11CodeGenerator implements CodeGenerator {
    generateMacro1(): string {
        return "#define uniqenum1(a,b,c,d)enum c{a=(b)}d\n"
    }
    generateMacro(method: GenerationMethod, n: number): string {
        const m = this.finishMacro(n);
        switch(method) {
            case GenerationMethod.Expanded:
                return m(this.generateExpandedMacro(n));
            case GenerationMethod.Row:
                return '' // todo
            case GenerationMethod.Triangle:
                return '' // todo
            default:
                throw new Error(`unsupported generation method: ${method}`);
        }
    }

    private finishMacro(n: number) {
        const p = Array.from({length: 2 * n + 2}, (_,i) => ident(i));
        const body = Array.from({length: n}, (_, i) => `${p[2 * i]}=(${p[2*i+1]})`);
        return (staticAssertionBody: string) => `#define uniqenum${n}(${p.join(',')})enum ${p.at(-2)}{${body.join(',')}}${p.at(-1)};_Static_assert(${staticAssertionBody},"duplicate enum values")\n`
    }

    private generateExpandedMacro(n: number): string {
        return Array.from(combinations(n), ([a,b]) => `((${ident(a)})-(${ident(b)}))`).join('*')
    }
}

/*const c_reserved_idents = new Set()
    .add('do')
    .add('if')
    .add('for')
    .add('int')
    .add('auto')
    .add('bool')
    .add('case')
    .add('char')
    .add('else')
    .add('enum')
    .add('goto')
    .add('long')
    .add('true')
    .add('void')
    .add('break')
    .add('const')
    .add('false')
    .add('float')
    .add('short')
    .add('union')
    .add('while')
    .add('double')
    .add('extern')
    .add('inline')
    .add('return')
    .add('signed')
    .add('sizeof')
    .add('static')
    .add('struct')
    .add('switch')
    .add('typeof')
    .add('alignas')
    .add('alignof')
    .add('default')
    .add('nullptr')
    .add('typedef')
    .add('continue')
    .add('register')
    .add('restrict')
    .add('unsigned')
    .add('volatile')
    .add('constexpr')
    .add('thread_local')
    .add('static_assert')
    .add('typeof_unqual');*/
