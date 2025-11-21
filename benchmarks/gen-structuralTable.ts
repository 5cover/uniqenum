import { writeFileSync } from 'fs';
import { join } from 'path';
import { CCodeGenerator } from '../src/CodeGenerator.js';
import { DEFAULT_NAMES } from '../src/const.js';
import { LengthWriter } from '../src/writing.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as g from '../src/g.js';

const RowHeaders = [
    'n',
    'areuniqSize',
    'uniqenumSize',
    'areuniqDepth',
    'effectiveComparisons',
    'minComparisons',
] as const;

type RowColumn = (typeof RowHeaders)[number];

export type StructuralRow = Record<RowColumn, number>;

export function runBenchmarks(nMax: number): Generator<StructuralRow> {
    const generator = new CCodeGenerator({ names: DEFAULT_NAMES });
    return g.seq(nMax, n => {
        n++;
        const areuniqSize = LengthWriter.ret(generator.areuniq, n);
        const uniqenumSize = LengthWriter.ret(generator.uniqenum, n);
        const metrics = generator.getAreuniqMetrics(n);
        return {
            n,
            areuniqSize,
            uniqenumSize,
            areuniqDepth: metrics.depth,
            effectiveComparisons: metrics.comparisons,
            minComparisons: binom2(n),
        } satisfies StructuralRow;
    });
}

function binom2(n: number): number {
    return (n * (n - 1)) / 2;
}

function toCsv(rows: Iterable<StructuralRow>, cols: RowColumn[]): string {
    cols = cols.includes('n') ? cols : ['n', ...cols] satisfies RowColumn[];
    const header = cols.join(',');
    const body = g.join(
        '\n',
        g.map(rows, row => cols.map(col => row[col]).join(','))
    );
    return `${header}\n${body}\n`;
}

function toLineChart(rows: StructuralRow[], cols: RowColumn[]) {
    const canvas = new ChartJSNodeCanvas({ width: 640, height: 480 });
    return canvas.renderToBuffer({
        type: 'line',
        data: {
            labels: rows.map(r => r.n),
            datasets: cols.map(
                label =>
                    ({
                        label,
                        data: rows.map(r => r[label]),
                    }) as const
            ),
        },
    });
}

(async () => {
    const outputPath = join(import.meta.dirname, 'structural-table');
    const rows = [...runBenchmarks(100)];
    const cols: RowColumn[] = ['minComparisons', 'effectiveComparisons'];
    writeFileSync(outputPath + '.csv', toCsv(rows, cols), 'utf8');
    //writeFileSync(outputPath + '.png', await toLineChart(rows, cols));
})();
