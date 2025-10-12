#!/usr/bin/env python3
import csv
import matplotlib.pyplot as plt


def main():
    seen = set()
    xs = []
    ys = []

    with open(__file__ + "/../../rects8193.18761.csv", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            n = int(row["n"])
            print(n)
            rects = row["rects"].strip().split()
            for r in rects:
                seen.add(r)
            xs.append(n)
            ys.append(len(seen))

    plt.figure(figsize=(10, 6))
    plt.plot(xs, ys, linewidth=1.2)
    plt.xlabel("N")
    plt.ylabel("Nombre cumulé de rectangles distincts")
    plt.title("Croissance des rectangles distincts rencontrés")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
