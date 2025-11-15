#ifndef UNIQ_bh_H
#define UNIQ_bh_H
#if UNIQENUM_ASSERT==2
#define _UNIQA(N,n,t,...)areuniq##N(__VA_ARGS__)
#elif UNIQENUM_ASSERT==0
#define _UNIQA(N,n,t,...)
#else
#ifdef UNIQENUM_ASSERT_ONCE
#define _UNIQA(N,n,t,...);UNIQENUM_ASSERT_ONCE(areuniq##N(__VA_ARGS__),n,t)
#else
#define _UNIQA(N,n,t,...)_Static_assert(areuniq##N(__VA_ARGS__),"enum has duplicate values: "#n" "#t)
#endif
#endif
#define uniqenum1(b,a,d,c)enum b{a d}c
#define uniqenum2(c,a,e,b,f,d)enum c{a e,b f}d _UNIQA(2,c,d,a,b)
#define uniqenum3(d,a,f,b,g,c,h,e)enum d{a f,b g,c h}e _UNIQA(3,d,e,a,b,c)
#define uniqenum4(e,a,g,b,h,c,i,d,j,f)enum e{a g,b h,c i,d j}f _UNIQA(4,e,f,a,b,c,d)
#define uniqenum5(f,a,h,b,i,c,j,d,k,e,l,g)enum f{a h,b i,c j,d k,e l}g _UNIQA(5,f,g,a,b,c,d,e)
#define uniqenum6(g,a,i,b,j,c,k,d,l,e,m,f,n,h)enum g{a i,b j,c k,d l,e m,f n}h _UNIQA(6,g,h,a,b,c,d,e,f)
#define uniqenum7(h,a,j,b,k,c,l,d,m,e,n,f,o,g,p,i)enum h{a j,b k,c l,d m,e n,f o,g p}i _UNIQA(7,h,i,a,b,c,d,e,f,g)
#endif
