#ifndef UNIQ_a_H
#define UNIQ_a_H
#if UNIQENUM_ASSERT==2
#define _UNIQJ ;
#ifdef UNIQENUM_ASSERT_ALL
#define areuniq2(a,b);UNIQENUM_ASSERT_ALL((a)!=(b),a,b)
#else
#define areuniq2(a,b)_Static_assert((a)!=(b),"duplicate enum values: "#a" and "#b)
#endif
#else 
#define _UNIQJ *
#define areuniq2(a,b)((a)!=(b))
#endif
#define areuniq3(a,b,c)areuniq2(a,b)_UNIQJ areuniq2(a,c)_UNIQJ areuniq2(b,c)
#define areuniq4(a,b,c,d)areuniq3(a,b,c)_UNIQJ areuniq3(a,b,d)_UNIQJ areuniq2(c,d)
#define areuniq5(a,b,c,d,e)areuniq4(a,b,c,d)_UNIQJ areuniq3(a,b,e)_UNIQJ areuniq3(c,d,e)
#define areuniq6(a,b,c,d,e,f)areuniq4(a,b,c,d)_UNIQJ areuniq4(a,b,e,f)_UNIQJ areuniq4(c,d,e,f)
#define areuniq7(a,b,c,d,e,f,g)areuniq5(a,b,c,d,e)_UNIQJ areuniq5(a,b,c,f,g)_UNIQJ areuniq4(d,e,f,g)
#define areuniq8(a,b,c,d,e,f,g,h)areuniq6(a,b,c,d,e,f)_UNIQJ areuniq5(a,b,c,g,h)_UNIQJ areuniq5(d,e,f,g,h)
#define areuniq9(a,b,c,d,e,f,g,h,i)areuniq6(a,b,c,d,e,f)_UNIQJ areuniq6(a,b,c,g,h,i)_UNIQJ areuniq6(d,e,f,g,h,i)
#endif
