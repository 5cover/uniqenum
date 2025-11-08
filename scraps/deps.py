# uniqenum_graph_compressed.py
import math
from collections import defaultdict

N_MAX = 100

# Step 1. Build dependency graph
edges = {}
for n in range(2, N_MAX + 1):
    deps = []
    a = math.floor(3 * n / 2)
    b = math.ceil(3 * n / 2)
    if a <= N_MAX:
        deps.append(a)
    if b <= N_MAX and b != a:
        deps.append(b)
    edges[n] = deps

# Step 2. Compute in/out degrees
in_deg = defaultdict(int)
out_deg = defaultdict(int)
for src, dsts in edges.items():
    out_deg[src] = len(dsts)
    for dst in dsts:
        in_deg[dst] += 1

# Step 3. Identify chain segments
chains = []
visited = set()

for node in range(2, N_MAX + 1):
    if node in visited:
        continue
    if out_deg[node] == 0:
        continue  # no outgoing edges, skip
    # start new chain if this node doesn't have exactly one parent or child
    if in_deg[node] != 1 or out_deg[node] != 1:
        for target in edges.get(node, []):
            chain = [node]
            nxt = target
            while (
                nxt in edges
                and in_deg[nxt] == 1
                and out_deg[nxt] == 1
                and nxt not in visited
            ):
                chain.append(nxt)
                visited.add(nxt)
                nxt = edges[nxt][0]
            if nxt not in chain:
                chain.append(nxt)
            visited.update(chain)
            chains.append(chain)

# Step 4. Output compressed Mermaid graph
print("graph TD")
for chain in chains:
    chain = [str(x) for x in chain if x is not None]
    print("    " + " --> ".join(chain))
