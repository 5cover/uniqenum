import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { devNull, tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import { CCodeGenerator } from '../src/CodeGenerator.js';
import { DEFAULT_NAMES } from '../src/const.js';
import { generate } from '../src/index.js';

const DefaultRanges = [
    [2, 64],
    [2, 128],
    [2, 256],
    [2, 512],
] as const;

const DefaultCompilers = ['gcc', 'clang', 'tcc'] as const;

type Range = readonly [start: number, end: number];

type Compiler = {
    command: string;
    label: string;
    checkKind: string;
    checkArgs: (sourcePath: string) => string[];
    fullArgs: (sourcePath: string) => string[];
};

type BenchmarkRow = {
    range: string;
    fileBytes: number;
    maxMacroDepth: number;
    compiler: string;
    checkSeconds: number;
    checkStatus: string;
    fullSeconds: number;
    fullStatus: string;
    notes: string;
};

type Measurement = {
    seconds: number;
    status: string;
};

function parseRanges(argv: string[]): Range[] {
    if (!argv.length) return [...DefaultRanges];
    return argv.flatMap(arg =>
        arg.split(',').map(part => {
            const [start, end] = part.split('-').map(Number);
            if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
                throw new Error(`Invalid range "${part}". Expected START-END, for example 2-128.`);
            }
            return [start, end] as const;
        })
    );
}

function availableCompilers(): Compiler[] {
    return DefaultCompilers.filter(command => commandExists(command)).map(command => {
        const checkKind = command === 'tcc' ? 'compile-only' : 'syntax-only';
        return {
            command,
            label: compilerVersion(command),
            checkKind,
            checkArgs: sourcePath =>
                command === 'tcc'
                    ? ['-std=c11', '-c', sourcePath, '-o', devNull]
                    : ['-std=c11', '-fsyntax-only', sourcePath],
            fullArgs: sourcePath => ['-std=c11', sourcePath, '-o', devNull],
        };
    });
}

function commandExists(command: string): boolean {
    try {
        execFileSync('which', [command], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function compilerVersion(command: string): string {
    const firstLine = execFileSync(command, ['--version'], { encoding: 'utf8' }).split('\n')[0]?.trim();
    return firstLine || command;
}

function enumInvocation(n: number): string {
    const pairs = Array.from({ length: n }, (_, i) => `    BENCH_${i},=${i}`).join(',\n');
    return `typedef uniqenum${n}(bench_enum,\n${pairs},\nbench_enum_t);\n`;
}

function writeProgram(path: string, headerName: string, n: number): void {
    writeFileSync(
        path,
        [
            '#define UNIQENUM_ASSERT 1',
            `#include "${headerName}"`,
            enumInvocation(n),
            'static bench_enum_t bench_value(void) { return BENCH_0; }',
            'int main(void) { return bench_value(); }',
            '',
        ].join('\n'),
        'utf8'
    );
}

function measure(command: string, args: string[], cwd: string): Measurement {
    const start = process.hrtime.bigint();
    try {
        execFileSync(command, args, { cwd, stdio: 'pipe' });
        const elapsed = process.hrtime.bigint() - start;
        return { seconds: Number(elapsed) / 1_000_000_000, status: 'ok' };
    } catch (error) {
        const elapsed = process.hrtime.bigint() - start;
        return { seconds: Number(elapsed) / 1_000_000_000, status: failureStatus(error) };
    }
}

function failureStatus(error: unknown): string {
    if (!isExecError(error)) return 'failed';
    const detail = error.signal ?? error.status ?? 'failed';
    const stderr = error.stderr
        ?.toString()
        .split('\n')
        .find(line => line.trim());
    return stderr ? `failed:${detail}:${stderr.trim()}` : `failed:${detail}`;
}

function isExecError(error: unknown): error is { status?: number; signal?: string; stderr?: Buffer } {
    return typeof error === 'object' && error !== null;
}

function benchmarkRange(range: Range, compilers: Compiler[]): BenchmarkRow[] {
    const [start, end] = range;
    const dir = mkdtempSync(join(tmpdir(), 'uniqenum-bench-'));
    try {
        const headerPath = join(dir, `uniqenum_${start}_${end}.h`);
        const sourcePath = join(dir, `bench_${end}.c`);
        generate({
            N: { start, end },
            output: { type: 'file', path: headerPath },
            includeGuard: 'pragmaOnce',
            macros: { areuniq: true, uniqenum: true },
        });
        writeProgram(sourcePath, basename(headerPath), end);

        const generator = new CCodeGenerator({ names: DEFAULT_NAMES });
        const fileBytes = statSync(headerPath).size;
        const maxMacroDepth = generator.getAreuniqMetrics(end).depth;

        return compilers.map(compiler => {
            const check = measure(compiler.command, compiler.checkArgs(sourcePath), dirname(sourcePath));
            const full = measure(compiler.command, compiler.fullArgs(sourcePath), dirname(sourcePath));
            return {
                range: `${start}-${end}`,
                fileBytes,
                maxMacroDepth,
                compiler: compiler.label,
                checkSeconds: check.seconds,
                checkStatus: check.status,
                fullSeconds: full.seconds,
                fullStatus: full.status,
                notes: `${compiler.checkKind} check; full compile links to ${devNull}`,
            };
        });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function toCsv(rows: BenchmarkRow[]): string {
    const header = [
        'range',
        'fileBytes',
        'maxMacroDepth',
        'compiler',
        'checkSeconds',
        'checkStatus',
        'fullSeconds',
        'fullStatus',
        'notes',
    ];
    const body = rows.map(row =>
        [
            row.range,
            row.fileBytes,
            row.maxMacroDepth,
            csvQuote(row.compiler),
            row.checkSeconds.toFixed(3),
            csvQuote(row.checkStatus),
            row.fullSeconds.toFixed(3),
            csvQuote(row.fullStatus),
            csvQuote(row.notes),
        ].join(',')
    );
    return `${header.join(',')}\n${body.join('\n')}\n`;
}

function csvQuote(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
}

const outputPath = join(import.meta.dirname, 'results.csv');
const compilers = availableCompilers();
if (!compilers.length) throw new Error('No supported C compiler found. Expected gcc, clang, or tcc on PATH.');
const rows = parseRanges(process.argv.slice(2)).flatMap(range => benchmarkRange(range, compilers));
writeFileSync(outputPath, toCsv(rows), 'utf8');

if (!existsSync(outputPath)) {
    throw new Error(`Benchmark output was not written: ${outputPath}`);
}
