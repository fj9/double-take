"""Run the old skill engine on a sample image and write what it produces as JSON, for comparison with the JS core.

    python tools/reference/run_reference.py IMAGE OUT.json [--colours N] [--seam fade|accept]

Needs numpy, scipy and Pillow. Nothing from here is shipped: it is only the yardstick for tools/parity.
"""
import argparse, json, sys, os
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import skill_engine as se  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("image")
ap.add_argument("out")
ap.add_argument("--colours", type=int, default=3)
ap.add_argument("--seam", default="accept")
ap.add_argument("--min-patch", type=int, default=4)
args = ap.parse_args()

W, H = 112, 75
pal, shares, cov = se.extract_palette(args.image, cap=6)
out = {
    "image": os.path.basename(args.image),
    "palette": [[round(float(v), 2) for v in c] for c in pal],
    "shares": [round(float(s), 5) for s in shares],
    "coverage": round(float(cov), 5),
    "colours": args.colours,
}
if args.colours <= 3:
    roles, cen = se.photo_to_roles(args.image, W, H, k=args.colours, wrap_x=(args.seam == "fade"), min_patch=args.min_patch)
else:
    roles, cen = se.stripes_roles(args.image, W, H, cap=args.colours, min_patch=args.min_patch, seam=args.seam)
out["centres"] = [[round(float(v), 2) for v in c] for c in cen]
out["roles"] = roles.astype(int).tolist()  # image order: row 0 is the top round, column 0 is the photo's left (stitch 112)
out["role_shares"] = [round(float(x), 5) for x in (np.bincount(roles.ravel(), minlength=roles.max() + 1) / roles.size)]
if args.colours > 3:
    cmp = se.compare_options(roles)
    out["compare"] = {"recommend": cmp["recommend"], "A": cmp["A"], "B": {k: (float(v) if not isinstance(v, int) else v) for k, v in cmp["B"].items()}}
    seq, rows = se.plan_pairs(roles)
    out["pairs"] = [list(map(int, p)) for p in seq]
json.dump(out, open(args.out, "w"))
print(f"{args.image}: {args.colours} colours, coverage {cov:.2f}, role shares {out['role_shares']}")
