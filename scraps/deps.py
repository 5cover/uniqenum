# uniqenum_graph.py
from math import ceil

N = range(3,17)

# print the longest chains in a grpah where each node n <= N_MAX is connected to ceil(2n/3) and floor(2n/3)
# so each node is connected to 1 or 2 neighbor which are always smaller


def mermaid_basic():
    print('flowchart')
    edges: list[tuple[int,int]] = []
    for n in N:
        a = 2 * n // 3
        b = ceil(2 * n / 3)
        if a > 1:
            edges.append((n,a))
        if b > 1 and b != a:
            edges.append((n,b))
    for a,b in sorted(edges):
        print(f"{a}-->{b}")

def mermaid_optimized():
    print('flowchart')
    tree: dict[int, set[int]] = {n: {2 * n // 3, ceil(2 * n / 3)} for n in  N} 

    def get_longest_chain(n: int) -> list[int]:
        if n not in tree:
            return []
        m = tree[n]
        c = max((get_longest_chain(n) for n in m), key=len) if m else []
        c.append(n)
        return c

    while len(c:=max((get_longest_chain(n) for n in N), key=len)) > 1:
        c.reverse()
        print(n:=c[0],end='')
        for m in c[1:]:
            if m not in tree[n]: break
            print('-->',end=str(m))
            tree[n].remove(m)
            n=m
        print()

def plantuml():
    print("@startuml")
    print("left to right direction")
    print("skinparam linetype ortho")
    print("skinparam backgroundColor #fafafa")
    print("skinparam arrowColor #888888")
    print("skinparam defaultFontSize 10")

    for n in N:
        a = 2 * n // 3
        b = ceil(2 * n / 3)
        if a >= 1:
            print(f"{n} --> {a}")
        if b >= 1 and b != a:
            print(f"{n} --> {b}")

    print("@enduml")


def graphviz():
    print("digraph uniqenum {")
    print("  rankdir=TB;")           # top-to-bottom layout
    print("  node [shape=circle, fontsize=10, width=0.3, fixedsize=true];")

    for n in N:
        a = 2 * n // 3
        b = ceil(2 * n / 3)
        if a >= 1:
            print(f"  {n} -> {a};")
        if b >= 1 and b != a:
            print(f"  {n} -> {b};")

    print("}")

def csacademy():
    edges: list[tuple[int,int]] = []
    for n in N:
        a = 2 * n // 3
        b = ceil(2 * n / 3)
        if a > 1:
            edges.append((n,a))
        if b > 1 and b != a:
            edges.append((n,b))
    for edge in sorted(edges):
        print(*edge)    
            
mermaid_basic()