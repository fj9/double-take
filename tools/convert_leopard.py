"""One-off converter: the old skill's leopard CSVs -> doubletake-chart/1 (patterned crown).

Also checks the CSVs against the rules in doubletake-app-spec.md (sections 5 and 10).
Run from the repo root: python3 tools/convert_leopard.py
"""
import csv, json, sys
from collections import Counter

SRC = "fixtures/leopard/source/"
OUT = "fixtures/leopard/leopard-patterned.doubletake.json"
PAIRS, BODY, CROWN, WEDGE = 112, 75, 20, 14
YARN = {"Pu": "A", "Pk": "B"}   # purple, pink; blue (Bl) is the duplicate stitch yarn C


def read(name):
    with open(SRC + name, newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    assert rows[0][0] == "Row" and len(rows[0]) == PAIRS + 1, name
    return {int(r[0]): r[1:] for r in rows[1:] if r and r[0].strip()}


def decreases():
    """Per crown round: (marked w set, removed w set) in the wedge, from spec section 5."""
    d = {}
    for k in range(9):
        d[76 + 2 * k] = ({2 + k}, {1 + k})
    d[94] = ({14, 11}, {13, 10})
    d[95] = ({12}, {11})
    return d


def expected_crown():
    """round -> (set of present pair numbers, set of marked pair numbers)."""
    d, removed, out = decreases(), set(), {}
    for rnd in range(76, 96):
        marks, rem = d.get(rnd, (set(), set()))
        removed |= rem
        present, marked = set(), set()
        for n in range(8):
            for w in range(1, WEDGE + 1):
                p = WEDGE * n + w
                if w in removed:
                    continue
                present.add(p)
                if w in marks:
                    marked.add(p)
        out[rnd] = (present, marked)
    return out


knit, dup = read("final_knit_chart.csv"), read("final_duplicate_stitch_blue.csv")
ckn, cdup = read("crown_patterned_chart.csv"), read("crown_duplicate_stitch_blue.csv")
assert sorted(knit) == sorted(dup) == list(range(1, 76)), "body rows"
assert sorted(ckn) == sorted(cdup) == list(range(76, 96)), "crown rows"

errors = []
body, body_dup = [], []
for r in range(1, BODY + 1):
    row = knit[r]
    bad = [c for c in row if c not in YARN]
    if bad: errors.append(f"body {r}: unexpected {set(bad)}")
    body.append("".join(YARN[c] for c in row))
    bd = dup[r]
    if any(c not in ("", "Bl") for c in bd): errors.append(f"dup {r}: unexpected {set(bd)}")
    body_dup.append("".join("1" if c == "Bl" else "0" for c in bd))

exp = expected_crown()
crown, crown_dup = [], []
for r in range(76, 96):
    present, marked = exp[r]
    s, sd = [], []
    seen_present, seen_marked = set(), set()
    for i in range(PAIRS):
        p, c, d = i + 1, ckn[r][i], cdup[r][i]
        base = c.rstrip("/")
        slash, dslash = c.endswith("/"), d.endswith("/")
        dbase = d.rstrip("/")
        if base == "":
            s.append("."); sd.append(".")
            if d != "": errors.append(f"crown {r} pair {p}: duplicate on a removed pair ({d!r})")
            continue
        if base not in YARN: errors.append(f"crown {r} pair {p}: unexpected {c!r}")
        seen_present.add(p)
        if slash: seen_marked.add(p)
        s.append(YARN.get(base, "?"))
        if dbase not in ("", "Bl"): errors.append(f"crown dup {r} pair {p}: {d!r}")
        sd.append("1" if dbase == "Bl" else "0")
        if dslash != slash: errors.append(f"crown {r} pair {p}: decrease mark differs between knit and duplicate charts")
    if seen_present != present:
        errors.append(f"crown {r}: present pairs differ from decrease table: missing {sorted(present - seen_present)[:6]} extra {sorted(seen_present - present)[:6]}")
    if seen_marked != marked:
        errors.append(f"crown {r}: marked pairs differ from decrease table: missing {sorted(marked - seen_marked)[:6]} extra {sorted(seen_marked - marked)[:6]}")
    crown.append("".join(s)); crown_dup.append("".join(sd))

pairs_per_round = [len(exp[r][0]) for r in range(76, 96)]
table = [104, 104, 96, 96, 88, 88, 80, 80, 72, 72, 64, 64, 56, 56, 48, 48, 40, 40, 24, 16]
if pairs_per_round != table: errors.append(f"pairs per round {pairs_per_round} != table")

chart = {
    "schema": "doubletake-chart/1",
    "name": "Leopard (example)",
    "created": "2026-10-29",
    "generator": {"tool": "convert_leopard.py", "version": "0.1.0"},
    "mode": "duplicate",
    "dimensions": {"pairs": PAIRS, "body_rounds": BODY, "crown_rounds": CROWN},
    "yarns": [
        {"id": "A", "name": "purple", "hex": "#6B2D9E", "role": "main"},
        {"id": "B", "name": "pink", "hex": "#F07EB5", "role": "main"},
        {"id": "C", "name": "blue", "hex": "#2A5FD0", "role": "duplicate"},
    ],
    "body": body,
    "round_pairs": None,
    "duplicate": [{"yarn": "C", "faces": "both", "body": body_dup, "crown": crown_dup}],
    "crown": {"variant": "patterned", "plain_from": None, "rounds": crown},
    "source": {"kind": "example", "note": "leopard print, converted from the original skill CSVs"},
}
# yardage deliberately omitted: TODO until sample knitting.

# ---- checks ----
for i, s in enumerate(body, 1):
    assert len(s) == PAIRS, i
for s in crown + crown_dup + body_dup:
    assert len(s) == PAIRS
print("body rounds:", len(body), "crown rounds:", len(crown))
print("pairs per crown round:", pairs_per_round)
print("two-colour rule (A/B only):", all(set(s) <= {"A", "B"} for s in body))

# Patches: cells with duplicate stitch, grid rows 1..95 (removed pairs absent), wrapping across the seam.
cells = set()
for r in range(1, 76):
    for i, ch in enumerate(body_dup[r - 1]):
        if ch == "1": cells.add((r, i))
for r in range(76, 96):
    for i, ch in enumerate(crown_dup[r - 76]):
        if ch == "1": cells.add((r, i))


def count(cells, diag, wrap, cross_crown=True):
    seen, n, sizes = set(), 0, []
    nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (-1, 1), (1, -1), (1, 1)] if diag else [])
    for start in sorted(cells):
        if start in seen: continue
        n += 1; stack = [start]; seen.add(start); size = 0
        while stack:
            r, c = stack.pop(); size += 1
            for dr, dc in nb:
                r2, c2 = r + dr, c + dc
                if wrap: c2 %= PAIRS
                elif not 0 <= c2 < PAIRS: continue
                if not cross_crown and (r <= 75) != (r2 <= 75): continue
                if (r2, c2) in cells and (r2, c2) not in seen:
                    seen.add((r2, c2)); stack.append((r2, c2))
        sizes.append(size)
    return n, sizes

n_all = len(cells)
body_n = sum(1 for r, _ in cells if r <= 75)
print(f"duplicate cells: {n_all} (body {body_n}, crown {n_all - body_n}); body share {body_n / (PAIRS * BODY):.1%}")
for label, kw in [("spec rules: diagonals, wrap, body+crown joined", dict(diag=True, wrap=True)),
                  ("side-by-side only, wrap", dict(diag=False, wrap=True)),
                  ("diagonals, no wrap", dict(diag=True, wrap=False)),
                  ("diagonals, wrap, body and crown separate", dict(diag=True, wrap=True, cross_crown=False))]:
    n, sizes = count(cells, **kw)
    print(f"patches [{label}]: {n}  (smallest {min(sizes)}, largest {max(sizes)})")

# Seam-crossing patches under the spec rules.
n_w, _ = count(cells, diag=True, wrap=True); n_nw, _ = count(cells, diag=True, wrap=False)
print("patches that only exist because of wrapping:", n_nw - n_w)

if errors:
    print(f"\n{len(errors)} PROBLEMS:")
    for e in errors[:40]: print(" -", e)
    sys.exit(1)

with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(chart, fh, indent=1)
print("\nwrote", OUT, "- all checks passed")
