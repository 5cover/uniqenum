# uniqenum

`uniqenum` is a C/C++ preprocessor macro library to enforce uniqueness of enumeration values at compile-time, using static assertions.

The code is written using a meta-programming generator written in TypeScript/Node.js.

For quick usage, see the [samples directory](samples/README.md) for pre-generated headers.

## Macro Usage & syntax

```text
uniqenum<N: number of enumerators>(<enum-name>,
    <key1>,=<value1>,
    <key2>,=<value2>,
    <key3>,, // implicit value, 1 greater than the previous value
    ...
    <keyN>,=<valueN>,
<typedef-name>)
```

`enum-name` and `typedef-name` can be blank.

Usage:

```c
typedef uniqenum5(E1e,A1,=1,B1,=2,C1,=3,D1,=4,E1,=5,E1t); // typedef enum E1e{} E1t  named + typedef
typedef uniqenum5(,A2,=1,B2,=2,C2,=3,D2,=4,E2,=5,E2t);    // typedef enum{} E2t    typedef
uniqenum5(E3e,A3,=1,B3,=2,C3,=3,D3,=4,E3,=5,);            // enum E3e{}            named
uniqenum5(,A4,=1,B4,=2,C4,=3,D4,=4,E4,=5,);               // enum{}              anonymous
```

## Macro configuration

Before including `areuniq` or `uniquenum` headers, you can define configuration macros to alter assertion behavior.

### `UNIQENUM_ASSERT`

Integer. Definies the assertion mode.

`UNIQENUM_ASSERT` value|Name|Description|Pros|Cons
-|-|-|-|-
0|none|Assertions disabled|Faster compilation|No verification of uniqueness
1 or undefined|once|Assert once all enumerators together|Verifies uniqueness<br>Acceptable compilation speed|Duplicate values can be hard to debug for large enums<br>Complex static assertion expressions for large enums
2|all|Assert all pairs|Verifies uniqueness<br>Shows duplicated enumerators|Slower compilation<br>Sometimes multiple assertions per pair under this implementation

> [!TIP]
> You can bind `UNIQENUM_ASSERT` to `NDEBUG` to map Uniqenum to existing debug/release configurations

### `UNIQENUM_ASSERT_ALL`

Function-like macro. Customizes the assertion to execute in assert-all mode. Syntax:

```c
#define UNIQENUM_ASSERT_ALL(expr,a,b) _Static_assert((expr), "duplicate enum values: "#a" and "#b)
```

- *expr* is the boolean expression to assert;
- *a* is the first enumerator;
- *b* is the second enumerator.

### `UNIQENUM_ASSERT_ONCE`

Function-like macro. Customizes the assertion to execute in assert-once mode. Syntax:

```c
#define UNIQENUM_ASSERT_ONCE(expr,name,type) _Static_assert((expr),"enum has duplicate values: "#name" "#type)
```

- *expr* is the boolean expression to assert;
- *name* is the name of the enumeration;
- *type* is the `typedef` name of the enumeration.

*name* and *type* may be empty if the enumeration doesn't declare a name/`typedef`.

## Generator Installation

The CLI and the API are shipped as the same npm package. Install globally for command-line usage, or add it to your project for programmatic generation.

```bash
npm install -g uniqenum      # CLI
npm install -D uniqenum      # API within a project
```

## Generator CLI usage

```sh
uniqenum <Nstart> [Nend]
```

- `Nstart` / `Nend` define the inclusive range of arity (`N`) to generate. `Nend` defaults to `Nstart`, and accepts `inf`/`infinity` for open-ended streams.
- By default, both `areuniq` and `uniqenum` families are emitted. Use `--areuniq` or `--uniqenum` to limit the output.
- `-o, --out-file <path>` defines the output path.
- `-d, --asdir` shreds the output into multiple headers (with automatic include tries) honoring `--max-size` per file.
- When neither is passed, output goes to stdout.
- `--max-size <bytes>` sets the byte budget when streaming to stdout or a single file (required for unbounded ranges). The directory mode defaults to 256 KiB if you omit it.
- `-g, --guard <classic|pragmaOnce|omit>` controls the include strategy for flat outputs; directory mode stores guards inside each shard.

Examples:

```sh
# 1. Stream both families for N=1..64 to stdout
uniqenum 1 64

# 2. Generate only areuniq headers for N=2..1024 sharded into 128 KiB files
uniqenum 2 1024 --areuniq -do build/headers --max-size 131072

# 3. Create a single ever-growing header capped at 256 KiB until the limit is reached
uniqenum 1 inf -o include/uniqenum.h --max-size 262144

# 4. Generate uniqenum only, but still warn when the file exceeds your cap
uniqenum 4 128 --uniqenum -o uniq128.h --max-size 65536
```

When both families are selected, the CLI interleaves them (`areuniqN` immediately followed by `uniqenumN`) so every uniqenum macro has a matching dependency in the same file. For finite ranges the generator will emit the whole interval, but will warn whenever the final size exceeds the configured `--max-size` by reporting the overage in bytes.

## Generator API usage

The `generate` function exposes the exact capabilities of the CLI plus additional formatting controls:

```ts
import { generate } from 'uniqenum';

generate({
    range: { start: 1, end: Infinity },            // single N or inclusive range
    macros: ['areuniq', 'uniqenum'],               // pick the families to emit
    includeGuards: 'classic',
    names: {                                       // optional macro name templates
        areuniq: ['areuniq', { ref: 'n' }],
        uniqenum: ['uniqenum', { ref: 'n' }],
    },
    output: {
        type: 'file',                              // 'stdout' | 'file' | 'directory'
        path: 'include/uniqenum.h',
        maxBytes: 256 * 1024,                      // required for unbounded ranges
    },
});
```

Output targets:

- `stdout`: streams directly to the current process output. Accepts `maxBytes` and `includeGuards`.
- `file`: writes a single header. Directories are created automatically. Requires `maxBytes` for infinite ranges.
- `directory`: splits output into multiple files with automatic include guards, trie-based layout, and dependency includes. Use `maxFileSize` to limit each shard.

All options are fully typed (see `src/index.ts`) so you get auto-complete inside TypeScript projects. The Samples generators (`samples/gen-samples.ts` and `samples/repository/gen-repository.ts`) are minimal scripts that exercise the API to produce the pre-generated headers committed in this repo.
