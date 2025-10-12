# Limits

from dataclasses import dataclass
import math
from collections import Counter


@dataclass(kw_only=True)
class Laws:
    file_size: int
    macro_arity: int
    macro_depth: int


"""
Inlining at the start

v2= (a-b)
v3= (a-b)*(a-c)*(b-c)
v4= (a-b)*(a-c)*(b-c)*(a-d)*(b-d)*(c-d)
v5= (a-b)*(a-c)*(b-c)*(a-d)*(b-d)*(c-d)*(a-e)*(b-e)*(c-e)*(d-e)

v5=x1_4(a,b,c,d,e)*x1_3(b,c,d,e)*x1_2(c,d,e)*x1_1(d,e)
v6=x1_4(a,b,c,d,e)*x1_1(a,f)*x1_4(b,c,d,e,f)*x1_3(c,d,e,f)*x1_2(d,e,f)*x1_1(e,f)

"""


def plan(law: Laws, n: int):
    """
    Plan a non-recursive expansion of v_n using blocks of size <= k.
    Returns a dict:
      {
        "blocks": [sizes of each block],
        "internals": Counter of v_m (block Vandermondes),
        "cross": Counter of xP_Q macros
      }
    """
    k = law.macro_arity

    # Partition N arguments into consecutive blocks of size <= k
    num_blocks = math.ceil(n / k)
    sizes = [k] * (num_blocks - 1) + [n - k * (num_blocks - 1)]

    internals = Counter()
    cross = Counter()

    # Every block of size > 1 contributes one internal Vandermonde
    for size in sizes:
        if size > 1:
            internals[f"v{size}"] += 1

    # Every unordered pair of blocks contributes one cross macro
    for i in range(len(sizes)):
        for j in range(i + 1, len(sizes)):
            p, q = sizes[i], sizes[j]
            cross[f"x{p}_{q}"] += 1

    return {"blocks": sizes, "internals": internals, "cross": cross}


laws = Laws(
    file_size=1024**2,  # 1 MB
    macro_arity=5,
    macro_depth=200
)
