# Samples

This directory contains sample generated header files created by running `ts-node samples/gen-samples.ts`.

Each header is named `uniqenum_<N>.h` where `<N>` is the maximum of enumerators.

Each header is sized by increments of 128KB up to 2MB.

Each header is self-contained and independent. To quickly use `uniqenum` in your project, pick the first header in this list whose N value is grater then or equal to the number of enumerators the in largest enum you want to enforce uniqueness in.

If your enum is larger than what is provided here, you can generate your own headers by running the `uniqenum` API or CLI.
