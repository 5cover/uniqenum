interface Formatter {
    defineMacro(name: string, arity: number, body: string): string;
}