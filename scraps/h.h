// Structural helpers. Naming convention: x<UPPERCASE/DIGIT>
// x: letter that starts the fewest words in the english dictionary. our prefix
#define xA enum
#define xB _Static_assert(
#define xC ,"duplicate enum values")

// example: #define enum2(a,b,c,d,e,f)xA e{a=(b),c=(d)}f;xB((b)-(d))xC

// Closed form approach

// x family: combinatorials
#define v2(a, b) ((a) - (b))
#define v3(a, b, c) v2(a, b) * x1_2(c, a, b)
#define v4(a, b, c, d) v3(a, b, c) * x1_3(d, a, b, c)
#define v5(a, b, c, d, e) v4(a, b, c, d) * x1_4(e, a, b, c, d)

// xf family -> to express combinatorials by N-1
// These macros restrict nesting to: (todo)
// parameter naming: for xP_Q -> increment idents starting at param P+1, then
// wrap around at end to reach P for x1_2 -> c,a,b

#define x1_1(b, a) ((b) - (a))
#define x1_2(c, a, b) ((c) - (a)) * ((c) - (b))
#define x1_3(d, a, b, c) ((d) - (a)) * ((d) - (b)) * ((d) - (c))
#define x1_4(e, a, b, c, d)                                                    \
  ((e) - (a)) * ((e) - (b)) * ((e) - (c)) * ((e) - (d))
#define x3_4(e, f, g, a, b, c, d)                                              \
  x1_4(e, a, b, c, d) * x1_4(f, a, b, c, d) * x1_4(g, a, b, c, d)
#define x4_3(e, f, g, h, a, b, c)                                              \
  x1_3(e, a, b, c) * x1_3(f, a, b, c) * x1_3(g, a, b, c) * x1_3(h, a, b, c)
#define x2_3(d, e, a, b, c) x1_3(d, a, b, c) * x1_3(e, a, b, c)
#define x3_3(d, e, f, a, b, c)                                                 \
  x1_3(d, a, b, c) * x1_3(e, a, b, c) * x1_3(f, a, b, c)
#define x3_1_3(c, d, A, a, b) x2_3(c, d, A, a, b) * x1_2(A, a, b)

int main() {
  int a, b, c, d, e, f, g, h;

  x3_1_3(a, b, c, d, e);

  // v5= (a-b)
  //     (a-c)(b-c)
  //     (a-d)(b-d)(c-d)
  //     (a-e)(b-e)(c-e)(d-e)
  v5(a, b, c, d, e);

  // v6= (a-b)
  //     (a-c)(b-c)
  //     (a-d)(b-d)(c-d)
  //     (a-e)(b-e)(c-e)(d-e)
  //     (a-f)(b-f)(c-f)(d-f)(e-f)
  //
  //  suppose  the limit is 5 macro arguments. how to express v6:
  v5(a, b, c, d, e) * x1_4(f, a, b, c, d) * v2(e, f);

  x2_3(a, b, c, d, e);

  // v7= (a-b)
  //     (a-c)(b-c)
  //     (a-d)(b-d)(c-d)
  //     (a-e)(b-e)(c-e)(d-e)
  //     (a-f)(b-f)(c-f)(d-f)(e-f)
  //     (a-g)(b-g)(c-g)(d-g)(e-g)(f-g)

  // v7:
  v5(a, b, c, d, e) * x1_4(f, a, b, c, d) * v2(e, f) * x1_4(g, a, b, c, d) *
      v2(e, g) * v2(f, g);
  // which can be simplified to (by merging v2(e,f)*v2(e,g)*v2(f,g) which is a
  // triangle)
  v5(a, b, c, d, e) * x1_4(f, a, b, c, d) * x1_4(g, a, b, c, d) * v3(e, f, g);

  // v8:
  //  {'ab','ac','ad','ae','af','ag','ah','bc','bd','be','bf','bg','bh','cd','ce','cf','cg','ch','de','df','dg','dh','ef','eg','eh','fg','fh','gh'}
  // -{'ab','ac','ad','ae','bc','bd','be','cd','ce','de'} (v5)
  // -{'bc','bd','be','bf','cd','ce','cf','de','df','ef'} (v5)
  // -{'cd','ce','cf','cg','de','df','dg','ef','eg','fg'} (v5)
  // -{'de','df','dg','dh','ef','eg','eh','fg','fh','gh'} (v5)
  // = {'bg', 'bh', 'ag', 'af', 'ch', 'ah'}

  v5(a, b, c, d, e) * x1_4(f, a, b, c, d) * v2(e, f) * x1_4(g, a, b, c, d) *
      v2(e, g) * v2(f, g) * x1_4(h, a, b, c, d) * v2(e, h) * v2(f, h) *
      v2(g, h);
  // simplification by merging x2s which reveal a square so v4 can be called
  v5(a, b, c, d, e) * x1_4(f, a, b, c, d) * x1_4(g, a, b, c, d) *
      x1_4(h, a, b, c, d) * v4(e, f, g, h);
  v5(a, b, c, d, e) * x3_4(f, g, h, a, b, c, d) * v4(e, f, g, h);

  // a -> f,g,h
  // b -> f,g,h
  // c -> f,g,h
  // d -> f,g,h
  ((a) - (f)) * ((b) - (f)) * ((c) - (f)) * ((d) - (f)) * ((a) - (g)) *
      ((b) - (g)) * ((c) - (g)) * ((d) - (g)) * ((a) - (h)) * ((b) - (h)) *
      ((c) - (h)) * ((d) - (h));
}

// Vandermonde determinant helpers

// Consider 5 is our macro limit instead of 127

/*#define x5sub(a,b,c,d,e) -((a)-(b))*((c)-(d))*((e)
#define x5star(a,b,c,d,e) *(a))*((b)-(c))*((d)-(e))

// Now supose we need three for completion at the start
#define v3(a,b,c) ((a)-(b))*((c)
// or 4
#define v4(a,b,c,d) ((a)-(b))*((c)-(d)))*/

// basic rule
// one macro for N mod 127
// + N/127 127 macros in
//   star then subs if N mod 127 is even
//   subs then stars if N mod 127 is odd
// ex with N=129
// N mod 127 = 2
// N / 127 = 1
// code: v2(a,b)x5sub(a,b,c,d,e)

// #define _2(a,b) ((a)-(b))
// #define _4(a,b,c,d) _2(a,b)*_2(c,d)
// #define _6(a,b,c,d,e,f) _2(a,b)*_4(c,d,e,f)
// #define _8(a,b,c,d,e,f,g,h) _4(a,b,c,d)*_4(e,f,g,h)
// #define _10(a,b,c,d,e,f,g,h,i,j) _2(a,b)*_8(c,d,e,f,g,h,i,j)
// #define _12(a,b,c,d,e,f,g,h,i,j,k,l) _6(a,b,c,d,e,f)*_6(g,h,i,j,k,l)
// #define _5l(a,b,c,d,e) _4(a,b,c,d)*((e)
// #define _5r(a,b,c,d,e) -(a))*_4(b,c,d,e)
// #define _3r(a,b,c) -(a))*_2(b,c)
