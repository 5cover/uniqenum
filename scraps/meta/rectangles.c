/// @file
/// @brief This program optimally (fewest, biggest rectangles) packs central
/// rectangles in a Vandermonde determinant's right triangle representation.
/// Inputs:
/// - rectangles [minN] [maxN] : computes packing for N from min to max
/// inclusive
/// - rectangles [maxN] : computes packing for N from 2 to max
/// Outputs:
/// CSV data to stdout.
/// Format: two columns: n, rects
/// - n: natural >= 2
/// - rects: space separated list of rectangles dimensions, width.height
///   ex: "2.3 2.3 4.1"

#define EX_USAGE 3
/// @brief Constant: maximum macro arity
#define K 127

#define CEIL_DIV(a, b) (((a) + (b) - 1) / (b))
/// @brief Formula: max packing rectangle width
#define MAX_W (K / 2)
/// @brief Formula: max packing rectangle height
#define MAX_H CEIL_DIV(K, 2)

#include <assert.h>
#include <limits.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

void tile_vandermonde(FILE *out, int n);

int main(int argc, char **argv) {
  int min, max;
  switch (argc) {
  case 2:
    min = 3;
    max = atoi(argv[1]);
    break;
  case 3:
    min = atoi(argv[1]);
    max = atoi(argv[2]);
    break;
  default:
    fprintf(stderr, "usage: %s [minN] maxN\n", argv[0]);
    return EX_USAGE;
  }
  if (min < 2 || max < 2) {
    fprintf(stderr, "invalid args: must be <2: min %d, max %d\n", min, max);
    return EX_USAGE;
  }

  FILE *const out = stdout;
  fprintf(out, "n,rects\n");
  for (int n = min; n <= max; ++n) {
    fprintf(out, "%d,", n);
    tile_vandermonde(out, n);
    putc('\n', out);
  }
}

#define put_rect(w, h)                                                         \
  fprintf(out, first ? (first = false, "%d.%d") : " %d.%d", w, h)

int evendiv(int x, int y) {
  // attempts to eliminate the reminder from a division by reducing the divisor
  // until the remainder is equal to the quotient. returns y if x % y == 0, < y
  // otherwise ex: x=126 y=65 naive: y=65. but remainer=61. big remainder.
  // 1*65+61=126 y=63 gives 0 remainder. 2*63=126 x=127 y=65 naive: y=65,
  // remainder=62 already optimal basic strategy: decrease y by n, add nq to the
  // reminder until remainder=y-n equation: y-n = r+nq y=r+nq+n y-r=nq+n
  // y-r=n(q+1)
  // n=(y-r)/(q+1)
  // n=(65-61)/(2)
  // n=4/2
  // n=2
  int const r = x % y;
  if (!r)
    return y;
  int const q = x / y;
  int const n = (y - r) / (q + 1);
  return y - n;
}

void tile_vandermonde(FILE *out, int n) {
  bool first = true;

  int full_w = n / 2;      // largeur totale du rectangle
  int full_h = n - full_w; // hauteur totale du rectangle

  // placer les blocs "standards" MAX_W × MAX_H
  for (int i = 0; i < full_w / MAX_W; ++i) {
    for (int j = 0; j < full_h / MAX_H; ++j) {
      put_rect(MAX_W, MAX_H);
    }
  }

  // restes
  int right_width = full_w % MAX_W;    // largeur de la bande de droite
  int right_block_h = K - right_width; // hauteur max d'un bloc dans cette bande

  int bottom_height = full_h % MAX_H; // hauteur de la bande du bas
  int bottom_block_w =
      K - bottom_height; // largeur max d'un bloc dans cette bande

  int effective_right_h = full_h;  // hauteur que la bande droite va couvrir
  int effective_bottom_w = full_w; // largeur que la bande basse va couvrir

  // Choisir qui est "primaire" (prend tout) et qui est "secondaire" (réduit)
  // combien de segments pour couvrir si on fait passer le bas en secondaire ?
  int segments_for_bottom = CEIL_DIV(full_w - right_width, bottom_block_w);
  // combien de segments si c’est la droite en secondaire ?
  int segments_for_right = CEIL_DIV(full_h - bottom_height, right_block_h);

  if (segments_for_bottom < segments_for_right) {
    // on réduit la largeur couverte par la bande basse
    effective_bottom_w -= right_width;
  } else {
    // on réduit la hauteur couverte par la bande droite
    effective_right_h -= bottom_height;
  }

  // Bande de droite
  if (right_width) {
    // Normaliser le divseur pour réduire la variance globale (nombre de macros
    // distinctes requises) et/ou transformer le reste en quotient, éliminant un
    // appel
    right_block_h = evendiv(effective_right_h, right_block_h);
    for (int i = 0; i < effective_bottom_w / right_block_h; ++i) {
      put_rect(right_width, right_block_h);
    }
    int leftover_h = effective_right_h % right_block_h;
    if (leftover_h)
      put_rect(right_width, leftover_h);
  }

  // Bande du bas
  if (bottom_height) {
    bottom_block_w = evendiv(effective_bottom_w, bottom_block_w);
    for (int i = 0; i < effective_bottom_w / bottom_block_w; ++i) {
      put_rect(bottom_block_w, bottom_height);
    }
    int leftover_w = effective_bottom_w % bottom_block_w;
    if (leftover_w)
      put_rect(leftover_w, bottom_height);
  }
}
