"""
Recursion
Plot for N
"""

from collections.abc import Set
from math import floor, log2, sqrt
import matplotlib.pyplot as plt


def generate_triangles(N: int, D: int):
    tris: Set[int] = set()
    depth: dict[int, int] = {1: -1, 2: 0}

    for n in range(3, N + 1):
        # depth if we continue as a row
        row_depth = depth[n - 1] + 1

        # depth if we make n a triangle
        tri_depth = max(depth[n // 2], depth[(n + 1) // 2])

        # prefer row unless that would exceed the limit
        if row_depth > D:
            tris.add(n)
            depth[n] = tri_depth
        else:
            depth[n] = row_depth

    return tris, depth


def plot_parity_plane(N: int, D: int, tris: set[int], depth: dict[int, int]):
    """
    Plots numbers based on their depth.
    Depth defines how far from the bottom left corner you should be.
    """
    xs, ys, colors = [], [], []
    for n, d in depth.items():
        if d <= 0:
            continue
        print(n, d)
        # depth as a ratio
        depth_ratio = d / D
        max_distance = sqrt(2*N)
        target_distance = depth_ratio * max_distance
        # x1 = 0, y1 = 0
        # x2 = n
        # we want y2 in the euclidean distance formula
        # d = sqrt((x2 - x1)² + (y2-y1)²)
        # d = sqrt(n² + y²)
        # y = sqrt(d² - n²)
        x, y = n, sqrt(abs(target_distance ** 2 - n ** 2))
        xs.append(x)
        ys.append(y)
        colors.append('red' if n in tris else 'blue')

    plt.figure(figsize=(10, 8))
    plt.scatter(xs, ys, c=colors, s=5)
    plt.title("The Map")
    plt.show()


N = 1_000
D = 20
tris, depth = generate_triangles(N, D)
plot_parity_plane(N, D, tris, depth)
"""
Prompt:

I want to create a mathematical fuction f.
The function will, for any natural number n > 2, compute to either 0 or 1.
When it returns 0, we'll call the antecedent n a "row".
When it returns 1, we'll call the antecedant n a "triangle".

Let there also be the depth function:
For any N, we apply a reduction algorithm using f until it reaches 2. It calls f recursively and modifying. Here are the steps to get depth(n):

1. If n<=2, return 0.
2. Apply f(n).
3. If f(n)=0 (n is a row), return 1+depth(n-1)
   If f(n)=1 (n is a triangle), return 1+max(depth(floor(n/2)), depth(ceil(n/2))

Knowing this, and knowing the maximum allowed depth (D, for instance 200), and the maximum allowed value of n (N, for instance 10^6) we want to define f so that:

- for all n <= N, depth(N)<=D
- we use the fewest possible amount of triangles, optimally (so effectively we'd be trying to minimize the sum of f for i from n to N)


Problem simplification:

I want to define 

"""
