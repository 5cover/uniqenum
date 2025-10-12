import matplotlib.pyplot as plt
import numpy as np
import math

D, N, *h = map(int, input().split())

fig, ax = plt.subplots(figsize=(12, 6))
ax.axis('off')

# base road (rural)
for n in range(2, N):
    ax.plot([n, n+1], [0, 0], color='lightgrey', lw=0.5)

# plot towns
ax.scatter(range(2, N+1), [0]*(N-1), s=3, color='grey')

# plot highways as arcs rising with log2 spacing
for n in sorted(h):
    dest = n // 2
    if dest >= 2:
        x1, x2 = n, dest
        xm = (x1 + x2) / 2
        # vertical height proportional to log2 difference
        y_top = math.log2(n) * 0.3
        t = np.linspace(0, np.pi, 40)
        xs = xm + (x1 - xm) * np.cos(t)
        ys = y_top * np.sin(t)
        ax.plot(xs, ys, color='darkorange', lw=0.6, alpha=0.8)

# highlight highways themselves slightly above ground
ax.scatter(sorted(h), [0.1]*len(h), s=10, color='orange')

ax.set_xlim(0, N+10)
ax.set_ylim(-0.5, 8)
plt.title(f"Hierarchical highway network (D={D}, N={N}, highways={len(h)})")
plt.savefig('out.png', dpi=100*N/D)
