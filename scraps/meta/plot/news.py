#!/usr/bin/env python3
import csv
import matplotlib.pyplot as plt


def main():
    seen = set()
    xs = []
    ys = []

    with open(__file__ + "/../../rects.csv", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            n = int(row["n"])
            rects = row["rects"].strip().split()
            new_rects = 0
            for r in rects:
                if r not in seen:
                    seen.add(r)
                    new_rects += 1
            xs.append(n)
            if (new_rects > 2):
                print(n, new_rects)
            ys.append(new_rects)

    plt.figure(figsize=(10, 6))
    plt.plot(xs, ys, linewidth=0.8)
    plt.xlabel("N")
    plt.ylabel("Nouveaux rectangles uniques à N")
    plt.title("Nombre de nouveaux rectangles par pas de N (jusqu'à N=8192)")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
