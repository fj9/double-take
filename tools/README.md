# Tools

- `convert_leopard.py`: converts the old skill's leopard CSVs into the example chart file and checks them against the spec.
- `reference/`: the old Python skill engine (unchanged) and a runner that writes its results to `reference/out/`. Needs numpy, scipy and Pillow.
- `parity.ts`: runs the JavaScript core on the same pictures and compares cell by cell. `npx tsx tools/parity.ts`. The pictures are read from `~/Downloads` and are not committed.
