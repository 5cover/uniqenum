

from collections.abc import Iterable, Sequence
import itertools
from util import ident


type Tree = Sequence[Tree] | int


def pack_tree(num_leaves: int, max_fanout: int) -> tuple[Tree, int]:
    """
    Build a tree where each node has at most `max_fanout` children,
    minimizing the number of nodes. Leaf nodes are just counts,
    since the exact ordering of factors is irrelevant.

    Returns the tree and the amount of nodes it contains
    """
    # start with a single "bucket" of num_leaves leaves
    level: list[Tree] = [1] * num_leaves
    n = 0
    while len(level) > 1:
        chunks = [level[i:i+max_fanout] for i in range(0, len(level), max_fanout)]
        # partition so shorter chunks come first
        small = [c for c in chunks if len(c) < max_fanout]
        full = [c for c in chunks if len(c) == max_fanout]
        # collapse trivial buckets: if a chunk is all ints of 1, just store len(chunk)

        def collapse(chunk: list[Tree]) -> Tree:
            nonlocal n
            if all(x == 1 for x in chunk):
                n += len(chunk)
                return len(chunk)
            else:
                n += 1
            return chunk
        level = [collapse(c) for c in (small + full)]
    return level[0], n


def summarize_node(node: Tree, indent=0):
    """
    Pretty print the packed tree.
    Lists of consecutive leaves are collapsed into "min..max".
    """
    s = "  " * indent
    if isinstance(node, int):  # leaf bucket
        return s + str(node)
    if len(node) == 1:  # root node
        return summarize_node(node[0], indent)
    # higher-level node
    return f'{s}{len(node)}\n{"\n".join(summarize_node(child, indent+1) for child in node)}'


def pretty_print_tree(num_leaves, max_fanout):
    tree, n = pack_tree(num_leaves, max_fanout)
    return summarize_node(tree, 0) + f"\n{n} macro calls"


def all_pairs(n):
    return itertools.combinations(map(ident, range(n)), 2)


def format_pairs(pairs: Iterable[tuple[str, str]]):
    def key(p): return p[1]
    return '\n'.join('('+')('.join(f'{p[0]}-{p[1]}' for p in g)+')' for _, g in itertools.groupby(sorted(pairs, key=key), key))


def all_triangles(n):
    elements = [ident(n) for n in range(n)]
    triangles = []
    for combo in itertools.combinations(elements, 3):
        a, b, c = combo
        # the 3 edges that make the triangle
        edges = [(a, b), (a, c), (b, c)]
        # sort each tuple for consistency
        edges = [tuple(sorted(e)) for e in edges]
        triangles.append(tuple(sorted(edges)))
    return triangles

# print(Counter(itertools.chain.from_iterable(all_triangles(4))))

# Example small tree
# print(pretty_print_tree(183, 10))
