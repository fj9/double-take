# Tools

- `make_leopard.ts`: makes the leopard example chart file from the leopard sample picture, at the current hat size (136 pairs, 95 body rounds, 26-round crown). `npx tsx tools/make_leopard.ts`.
- `reference/`: the old Python skill engine (unchanged) and a runner that writes its results to `reference/out/`. Needs numpy, scipy and Pillow.
- `parity.ts`: runs the JavaScript core on the same pictures and compares cell by cell. `npx tsx tools/parity.ts`. The pictures are read from `~/Downloads` and are not committed.

**The reference outputs and the parity check are frozen at the first gauge** (112 pairs, 75 body rounds, 25 pairs and 34 rounds to 4 in). The Python engine and `reference/out/` were never changed to the new gauge, so `parity.ts` no longer matches and is kept only as a record of how the first port was checked.
