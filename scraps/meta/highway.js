/**
 We have the following Constants:
 D=200, max distance
 N=10⁶, max N

 We are working in a one dimensional space of natural numbers starting from 2 to N inclusive.

 A metaphor for the problem: We're a civil engineering firm designing a highway system with the goal of connecting all towns (values of N) to the capital (n=2) by placing either highways or rural roads in each.
 Since highways are much more expensive and disrupting, we want to place as few highways as possible to connect every town while keeping the total distance from any town to the capital <= D

 How distance(n) is calculated:

 For any n in [2;N], we can compute its "distance" from 2 (which has a distance to itself of 0) as:

 - 0 if n = 2
 - 1 + max(distance(floor(n/2)), distance(ceil(n/2))) if n is a highway
 - 1 + distance(n - 1) otherwise (n is a rural road)

 We can start by considering there are roads everywhere.

 Goal : place the minimal amount of highways to ensure every town is connected to the capital by a distance <= D.

 Precision: any distance for N is fine, as long as it is <= D. There's no preference between a distance of 1 or 200. There also no need for the distance to be proportional to n.

 All that matters is distance(n) <= D for all n in [2;N]
*/


/** Max distance. for all n in [2;N], distance(n) <= D */
const D = 200;
/** Greatest value of N to consider. */
const N = 10 ** 3;


const h = solve();
test(h);


/** Solve the problem.
Prints values of N to places highways on (unsorted, duplicates allowed).
Returns the set of n values to place an highway on.
*/
function solve() {
    const h = new Set();
    let d_furthest_highway = 0;
    let d = 0;
    for (let n = 2; n <= N; ++n) {
        if (d + d_furthest_highway == D) {
            // Only place highways on even numbers, to avoid the max problem
            let m = n;
            do {
                h.add(m);
                m >>= 1;
            } while (m > 2 && m % 2 == 0 && !h.has(m));
            d_furthest_highway = distance(h, n);
            d = 0;
        } else {
            d++;
        }
    }
    return h;
}

/**
 * Test the highways.
 * Check if every town is in distancd(n) <= D
 */
function test(h, print) {
    const invalids = [];
    const cache = new Map();
    for (let n = 3; n <= N; ++n) {
        const d = distance(h, n, cache);
        if (d > D) {
            invalids.push(n);
            console.log(n);
            return 0;
        }
        if (print) console.log(n, +h.has(n), d, d > D ? "!!" : "");
    }
    if (print) {
        console.log('Unsorted H', h.size, ':', ...h);
        console.log('  Sorted H', h.size, ':', ...Array.from(h).sort((a, b) => a - b));
    } else {
        console.log('card(H)', '=', h.size);
    }
    if (invalids.length) {
        console.log('  Invalids', invalids.length, ':', ...invalids);
    }
}

function distance(h, n, cache) {
    if (n <= 2) return 0;
    let d = cache === undefined ? undefined : cache.get(n);
    if (d !== undefined) return d;
    if (h.has(n)) {
        const dHalf = distance(h, n >> 1, cache);
        d = 1 + (n % 2 ? Math.max(dHalf, distance(h, (n >> 1) + 1)) : dHalf);
    } else {
        d = 1 + distance(h, n - 1, cache);
    }
    cache?.set(n, d);
    return d;
}

function vis_hierarchy_spacing(h) {
    const sorted = Array.from(h).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);

    // count frequencies by bin size
    const bins = new Map();
    for (const g of gaps) {
        bins.set(g, (bins.get(g) || 0) + 1);
    }
    console.table([...bins.entries()].map(([gap, count]) => ({ gap, count })));

}

function vis_print(h) {
    console.log(D, N, ...h);
}

/**
 * Produce a Mermaid diagram showing the halving tree of highways.
 * (doesn't work well; produces way too many nodes)
 * @param {Set<number>} h - Set of highway numbers.
 * @param {number} D - Max allowed distance.
 * @param {number} N - Max N (upper bound of range).
 * @param {number} [maxNodes=5] - Limit to avoid million-node meltdown.
 * @returns {string} Mermaid diagram text block.
 */
function vis_mermaid(h, maxNodes = 5) {
    // Sort highways numerically
    const sorted = Array.from(h).sort((a, b) => a - b);

    // Sample roughly evenly if there are too many
    const step = Math.max(1, Math.floor(sorted.length / maxNodes));
    const sample = sorted.filter((_, i) => i % step === 0);

    // Pre-compute distances for coloring

    // Build Mermaid lines
    const lines = ["graph LR", "2[Capital n=2]"];
    for (const n of sample) {
        if (n <= 2) continue;
        const parent = Math.floor(n / 2);
        lines.push(`${n} --> ${parent}`);
        let budget = D - distance(h, n);
        let m = n - 1;
        while (budget > 0) {
            if (distance(h, m) <= budget) {
                lines.push(`${n} ..-> ${m}`);
                if (!sample.includes(m)) sample.push(m);
            }
            m--;
            budget--;
        }
    }

    // Wrap in Markdown-friendly code fence
    return "```mermaid\n" + lines.join("\n") + "\n```";
}

// Example usage:
// const mermaidText = generateMermaid(h, D, N);
// console.log(mermaidText);
