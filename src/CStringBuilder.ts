export class CStringBuilder {
    private code = '';
    private instr = false;
    str(str: string) {
        if (!this.instr) {
            this.code += '"';
            this.instr = true;
        }
        this.code += str.replaceAll(/["\\]/g, '\\$&').replaceAll('\n', '\\n').replaceAll('\r', '\\r');
        return this;
    }
    expr(expr: string) {
        this.closeStr();
        this.code += '#';
        this.code += expr;
        return this;
    }
    toString() {
        this.closeStr();
        return this.code;
    }
    forEach<T>(items: Iterable<T>, $do: (builder: this, item: T) => unknown) {
        for (const item of items) {
            $do(this, item);
        }
        return this;
    }
    private closeStr() {
        if (!this.instr) return;
        this.code += '"';
        this.instr = false;
    }
}
