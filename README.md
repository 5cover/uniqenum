  # macroaddict

Automatic C/C++ preprpocessor macro generation.

## Unique enums

```c
#include <stdio.h>
#define uniqenum5(a,b,c,d,e,f,g,h,i,j,k,l)enum k{a=(b),c=(d),e=(f),g=(h),i=(j)}l;_Static_assertenum5(((b)-(d))*((b)-(f))*((b)-(h))*((b)-(j))*((d)-(f))*((d)-(h))*((d)-(j))*((f)-(h))*((f)-(j))*((h)-(j)),"duplicate enum values")
uniq
typedef uniqenum5(A1,1,B1,2,C1,3,D1,4,E1,5,E1e,E1t); // typedef enum A{} A  named + typedef
typedef uniqenum5(A2,1,B2,2,C2,3,D2,4,E2,5,,E2t);    // typedef enum{} A    typedef
uniqenum5(A3,1,B3,2,C3,3,D3,4,E3,5,E3e,);            // enum A{}            named
uniqenum5(A4,1,B4,2,C4,3,D4,4,E4,5,,);               // enum{}              anonymous

int main() 
{
    enum E1e e1e;
    E1t e1t;
    E2t e2t;
    enum E3e e3e;
    printf("Hello World: %d %d %d %d %d", A4, B4, C4, D4, E4);

    return 0;
}
```

## Generation

stack: typescript & Node (speed + high level), NPM package `uniqenum` that outputs C code, and maybe more langs later?

We need the pluggable modules:

- idents: ident function
- rectangles: triangle method rectangle paving
- highway: recu
- ir: abstract representation of the generated
- codegen: abstract representation and pluggable code generation layer
