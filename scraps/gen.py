#!/usr/bin/env python3
# Generate a non-recursive maxN.h with ternary chains


import math

from util import ident, ident_len


def macro_max(n: int) -> str:
    args = [str(ident(i)) for i in range(n)]
    expr = f"({args[0]})"
    for arg in args[1:]:
        expr = f"({expr} > ({arg}) ? {expr} : ({arg}))"
    arglist = ",".join(args)
    return f"#define max{n}({arglist}) {expr}"


"""
Macros
#define D(a,b) ((a)-(b))
"""


def macro_unique_enum(n: int) -> str:
    if n < 1:
        raise ValueError('n must be > 0')
    # parameters for each key/value + name + typedef name
    args = ','.join(str(ident(i)) for i in range(2*n+2))

    # enum {a=b,c=d,...}
    enum_body = ",".join(f"{ident(2*i)}=({ident(2*i+1)})" for i in range(n))
    enum = f"enum {ident(2*n)}{{{enum_body}}}{ident(2*n+1)}"

    # uniqueness check with Vandermonde determinant
    if n > 1:
        product = "*".join(f"(({ident(2*i+1)})-({ident(2*j+1)}))" for i in range(n) for j in range(i + 1, n))
        static = f";_Static_assert({product},\"duplicate enum values\")"
    else:
        static = ''

    return f"#define enum{n}({args}){enum}{static}\n"


def digit_count(n: int) -> int:
    return math.floor(math.log10(abs(n))) + 1 if n else 1


# @cache
def macro_unique_enum_len(n: int) -> int:
    if n < 1:
        raise ValueError('n must be > 0')
    enumerators = sum(ident_len(i) for i in range(2*n))
    names = ident_len(2*n)+ident_len(2*n+1)
    # idents + commas
    args = enumerators + names + 2 * n + 1
    # idents + commas + equal signs + parens (2 per enumeator)
    enum_body = enumerators + n - 1 + 3 * n
    # enum keyword + space + 2 braces + names + body
    enum = 7 + names + enum_body
    if n > 1:
        product = math.comb(n, 2)-1 + sum(7 + ident_len(2*i+1) + ident_len(2*j+1) for i in range(n) for j in range(i + 1, n))
        static = 41 + product
    else:
        static = 0
    return 15 + digit_count(n) + args + enum + static


def test_macro_unique():
    n = 1
    while True:
        m = macro_unique_enum(n)
        l = macro_unique_enum_len(n)
        assert len(m) == l, (n, len(m), l, m)
        n += 1


def plot():
    import matplotlib.pyplot as plt
    # compute sizes for a range of N
    max_n = 200
    sizes = [sum(macro_unique_enum_len(m) for m in range(1, n+1)) for n in range(1, max_n+1)]

    plt.figure(figsize=(10, 6))
    plt.plot(range(1, max_n+1), sizes, marker='o')
    plt.xlabel("N (enum members)")
    plt.ylabel("Estimated bytes of macro definition")
    plt.title("Macro size growth with N")
    plt.grid(True)
    plt.show()


def nbudget(budget: int):
    total = 0
    n = 1
    while True:
        size = macro_unique_enum_len(n)
        if total + size > budget:
            break
        total += size
        print(total / budget)
        n += 1
    return n


def ident_from_hash(path):
    import hashlib
    h = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    n = int(h, 16)  # hex → integer
    return ident(n)
