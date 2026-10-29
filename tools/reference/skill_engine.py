"""The old photo-to-knitting-chart skill engine, copied unchanged from the skill file.
Used only as the reference for checking the JavaScript core (tools/reference/run_reference.py)."""
import numpy as np
from itertools import combinations
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi

def cell_at(grid, r, c):
    """r = round (1 = bottom), c = stitch (1 = RIGHT edge). grid[0] is the top round, grid[:, 0] is the photo's left = stitch W."""
    H, W = grid.shape
    return grid[H - r, W - c]

def seamless(a, axis, feather=0.15):
    a = np.moveaxis(a, axis, 1)
    n = a.shape[1]; s = max(2, int(n * feather))
    out = a[:, : n - s].copy()
    w = (np.arange(s) / s)[None, :, None]
    out[:, :s] = w * a[:, :s] + (1 - w) * a[:, n - s: n]
    return np.moveaxis(out, 1, axis)

def kmeans(px, k, iters=25, seed=0):
    rng = np.random.default_rng(seed)
    cen = [px[rng.integers(len(px))]]
    for _ in range(k - 1):
        d = np.min([((px - c) ** 2).sum(1) for c in cen], axis=0)
        cen.append(px[rng.choice(len(px), p=d / d.sum())])
    cen = np.array(cen)
    for _ in range(iters):
        lab = ((px[:, None, :] - cen[None]) ** 2).sum(2).argmin(1)
        for j in range(k):
            if (lab == j).any():
                cen[j] = px[lab == j].mean(0)
    return cen

def _wrap_pad(a, P, wrap_x, wrap_y):
    a = np.pad(a, ((0, 0), (P, P)), mode="wrap" if wrap_x else "edge")
    return np.pad(a, ((P, P), (0, 0)), mode="wrap" if wrap_y else "edge")

def cleanup(roles, k, min_patch, wrap_x, wrap_y):
    """Absorb patches of the non-ground colours smaller than min_patch cells."""
    H, W = roles.shape; P = 6
    pad = _wrap_pad(roles, P, wrap_x, wrap_y); out = pad.copy()
    for r in range(1, k):
        lab, n = ndi.label(pad == r)
        for i in range(1, n + 1):
            comp = lab == i
            if comp.sum() < min_patch:
                ring = ndi.binary_dilation(comp) & ~comp
                out[comp] = np.bincount(pad[ring], minlength=k).argmax()
    return out[P:P + H, P:P + W]

def photo_to_roles(path, W, H, k=3, gauge=(25, 34), crop=None, wrap_x=True, wrap_y=False, min_patch=3, work=4):
    """roles[H, W]: 0 = most frequent colour ... k-1 = least; plus RGB centres in that order.
    gauge = (stitch pairs, rounds) per same length. Default 25 x 34 = 1.36 rounds per pair: cells are wider than tall,
    so the picture is cropped to the true shape of the fabric."""
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(crop)
    target = (W / gauge[0]) / (H / gauge[1])
    w, h = im.size
    if w / h > target:
        nw = int(h * target); x0 = (w - nw) // 2; im = im.crop((x0, 0, x0 + nw, h))
    else:
        nh = int(w / target); y0 = (h - nh) // 2; im = im.crop((0, y0, w, y0 + nh))
    a = np.asarray(im).astype(float)
    if wrap_x: a = seamless(a, 1)
    if wrap_y: a = seamless(a, 0)
    im = Image.fromarray(a.astype("uint8")).resize((W * work, H * work), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(work * 0.6))
    px = np.asarray(im).astype(float).reshape(-1, 3)
    sub = px[np.random.default_rng(1).choice(len(px), min(30000, len(px)), replace=False)]
    cen = kmeans(sub, k)
    lab = ((px[:, None, :] - cen[None]) ** 2).sum(2).argmin(1).reshape(H * work, W * work)
    g = np.stack([(lab.reshape(H, work, W, work) == j).sum((1, 3)) for j in range(k)]).argmax(0)
    roles = cleanup(g, k, min_patch, wrap_x, wrap_y)
    order = np.argsort(-np.bincount(roles.ravel(), minlength=k))     # rank AFTER cleanup
    remap = np.empty(k, int); remap[order] = np.arange(k)
    return remap[roles], cen[order]

def split_duplicate(roles):
    """Roles 0 and 1 (two most used) are knitted; every other role is duplicate stitch (3 colour: role 2 only).
    Each duplicate patch is knitted in whichever of roles 0/1 dominates its surrounding ring. Returns knit (0/1), ds mask."""
    ds = roles >= 2; knit = roles.copy(); k = int(roles.max()) + 1
    lab, n = ndi.label(ds)
    for i in range(1, n + 1):
        comp = lab == i; ring = ndi.binary_dilation(comp) & ~ds
        knit[comp] = int(np.bincount(roles[ring], minlength=k)[:2].argmax()) if ring.any() else 0
    return knit, ds

# ---------------- palette picker (any image: flat art, fabric, watercolour) ----------------
def rgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def _kmeans_lab(x, k, iters=30, seed=0):
    rng = np.random.default_rng(seed); cen = [x[rng.integers(len(x))]]
    for _ in range(k - 1):
        d = np.min([((x - c) ** 2).sum(1) for c in cen], axis=0); cen.append(x[rng.choice(len(x), p=d / d.sum())])
    cen = np.array(cen)
    for _ in range(iters):
        lab = ((x[:, None] - cen[None]) ** 2).sum(2).argmin(1)
        for j in range(k):
            if (lab == j).any(): cen[j] = x[lab == j].mean(0)
    return cen

def extract_palette(path, cap=6, crop=None, merge_dE=18.0, min_share=0.01, rare_share=0.004, rare_dE=35.0, over=14, size=320):
    """Palette for ANY image. Works in Lab so 'near' means 'looks alike'.
    1. over-cluster (k=over) a downsized, speckle-filtered copy; 2. merge clusters closer than merge_dE (share-weighted);
    3. drop clusters under min_share unless rare but very distinct (>= rare_dE from all others: a small red accent);
    4. merge down to `cap` using a Ward cost, so big distinct colours survive and small near ones go first.
    Returns (palette_rgb[n,3] by share, shares[n], coverage); coverage = share of pixels within 15 dE of a palette colour.
    coverage < 0.70 means gradient or fine texture: warn that it will blur at hat size."""
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(crop)
    im.thumbnail((size, size)); im = im.filter(ImageFilter.MedianFilter(3))
    rgb = np.asarray(im).reshape(-1, 3).astype(float); lab = rgb_to_lab(rgb)
    cen = _kmeans_lab(lab[np.random.default_rng(1).choice(len(lab), min(20000, len(lab)), replace=False)], over)
    lbl = ((lab[:, None] - cen[None]) ** 2).sum(2).argmin(1)
    cl = [dict(lab=lab[lbl == j].mean(0), rgb=rgb[lbl == j].mean(0), n=int((lbl == j).sum())) for j in range(over) if (lbl == j).any()]
    def merge(a, b):
        n = a["n"] + b["n"]; return dict(lab=(a["lab"] * a["n"] + b["lab"] * b["n"]) / n, rgb=(a["rgb"] * a["n"] + b["rgb"] * b["n"]) / n, n=n)
    def closest(cl):
        best = (1e9, 0, 1)
        for i in range(len(cl)):
            for j in range(i + 1, len(cl)):
                d = np.linalg.norm(cl[i]["lab"] - cl[j]["lab"])
                if d < best[0]: best = (d, i, j)
        return best
    while len(cl) > 1:
        d, i, j = closest(cl)
        if d >= merge_dE: break
        cl[i] = merge(cl[i], cl[j]); del cl[j]
    tot = len(lab)
    def keep(c):
        s = c["n"] / tot
        if s >= min_share: return True
        return s >= rare_share and min(np.linalg.norm(c["lab"] - o["lab"]) for o in cl if o is not c) >= rare_dE
    cl = [c for c in cl if keep(c)] or cl
    while len(cl) > cap:
        best = (1e18, 0, 1)
        for i in range(len(cl)):
            for j in range(i + 1, len(cl)):
                w = cl[i]["n"] * cl[j]["n"] / (cl[i]["n"] + cl[j]["n"]) * np.sum((cl[i]["lab"] - cl[j]["lab"]) ** 2)
                if w < best[0]: best = (w, i, j)
        _, i, j = best; cl[i] = merge(cl[i], cl[j]); del cl[j]
    cl.sort(key=lambda c: -c["n"])
    pal = np.array([c["rgb"] for c in cl]); shares = np.array([c["n"] / tot for c in cl])
    plab = np.array([c["lab"] for c in cl])
    cov = float((np.sqrt(((lab[:, None] - plab[None]) ** 2).sum(2)).min(1) < 15).mean())
    return pal, shares, cov

# ---------------- 4-6 colours: duplicate stitch (A) vs stripes (B) ----------------
def stripes_roles(path, W, H, cap=6, gauge=(25, 34), crop=None, min_patch=5, merge=18, seam='accept'):
    """Palette from extract_palette. seam='accept' (picture-like) or 'fade' (pattern-like, tiles round the tube)."""
    global kmeans
    seeds = extract_palette(path, cap=cap, crop=crop, merge_dE=merge)[0]
    def seeded(px, k, iters=25, seed=0):
        cen = seeds.copy()
        for _ in range(iters):
            lab = ((px[:, None, :] - cen[None]) ** 2).sum(2).argmin(1)
            for j in range(len(cen)):
                if (lab == j).any(): cen[j] = px[lab == j].mean(0)
        return cen
    old = kmeans; kmeans = seeded
    try: return photo_to_roles(path, W, H, k=len(seeds), gauge=gauge, crop=crop, wrap_x=(seam == 'fade'), wrap_y=False, min_patch=min_patch)
    finally: kmeans = old

def plan_pairs(roles, lam=25):
    """Two yarns per round, bottom to top. DP over colour pairs: cost = cells outside the pair (duplicate stitch)
    + lam per yarn change. Tiny tie-break prefers common colours. Returns (pairs bottom->top, roles row index per round)."""
    K = roles.max() + 1; Hh = roles.shape[0]; pairs = list(combinations(range(K), 2))
    need = np.array([[roles.shape[1] - (roles[i] == a).sum() - (roles[i] == b).sum() for a, b in pairs] for i in range(Hh)], float)
    share = np.bincount(roles.ravel(), minlength=K) / roles.size
    need = need + 0.01 * np.array([1 - (share[a] + share[b]) for a, b in pairs])[None, :]
    rows = list(range(Hh - 1, -1, -1))
    trans = np.array([[2 - len({*pa} & {*pb}) for pb in pairs] for pa in pairs])
    dp = need[rows[0]].copy(); back = []
    for r in rows[1:]:
        tot = dp[:, None] + lam * trans; back.append(tot.argmin(0)); dp = tot.min(0) + need[r]
    p = int(dp.argmin()); seq = [p]
    for b in reversed(back): p = int(b[p]); seq.append(p)
    return [pairs[p] for p in seq[::-1]], rows

def summarise(roles, seq, rows):
    ds = sum(int(sum(c not in pr for c in roles[i])) for pr, i in zip(seq, rows))
    chg = sum(2 - len({*a} & {*b}) for a, b in zip(seq, seq[1:])); blocks = 1 + sum(a != b for a, b in zip(seq, seq[1:]))
    return dict(ds_cells=ds, ds_share=ds / roles.size, yarn_changes=chg, blocks=blocks,
                rounds_3plus=int(sum(len(set(r)) > 2 for r in roles)))

def band_share(roles, colour):
    """Share of a colour's cells in rounds where it covers over half the round. High = stripe-like layers."""
    m = roles == colour; tot = m.sum()
    return float(m[m.mean(1) > 0.5].sum() / tot) if tot else 0.0

def compare_options(roles, lam=25, warn=0.10, hard=0.25):
    """A = knit top 2 colours, embroider the rest (outside). B = stripes. recommend: 'A', 'B' or 'none' (both over the hard limit)."""
    share = np.bincount(roles.ravel(), minlength=roles.max() + 1) / roles.size
    a = dict(ds_share=float(1 - share[:2].sum()), colours=int(len(share) - 2),
             band_like={int(c): round(band_share(roles, c), 2) for c in range(2, len(share))})
    seq, rows = plan_pairs(roles, lam); b = summarise(roles, seq, rows)
    if len(share) == 2: rec = "A"
    elif a["ds_share"] <= warn: rec = "A"
    elif a["ds_share"] > hard and b["ds_share"] > hard: rec = "none"
    elif a["ds_share"] > hard: rec = "B"
    else: rec = "B" if b["ds_share"] < a["ds_share"] / 2 else "A"
    return dict(A=a, B=b, recommend=rec)

# ---------------- crown ----------------
def crown_rounds(W, wedges=8):
    return 2 * (W // wedges) - 8

def crown_present(r, start, W, wedges=8):
    """{stitch: is_decrease} for crown round r. n = W/wedges; n=14: 20 rounds, 104,104,96,96,...,40,40,24,16 pairs."""
    n = W // wedges; rr = r - start; out = {}
    for L in [W - n * k for k in range(wedges)]:
        if rr < 2 * (n - 5):
            cols = [L - j for j in range(n - (rr // 2 + 1))]
            for c in cols: out[c] = False
            if rr % 2 == 0: out[cols[-1]] = True
        elif rr == 2 * (n - 5):
            for c in (L, L - 2, L - 3): out[c] = False
            out[L] = out[L - 3] = True
        else:
            for c in (L, L - 2): out[c] = False
            out[L - 2] = True
    return out

def patterned_crown(roles, start, W, wedges=8):
    H = roles.shape[0]; n = crown_rounds(W, wedges)
    return np.stack([roles[H - 1 - ((start + i - 1) % H)] for i in range(n)])

def plain_crown(roles, start, W, close_to=85, wedges=8, wrap_x=True):
    """Mirror the top body round upward for rounds start..close_to, keep only patches touching it, ground after."""
    H = roles.shape[0]; n = crown_rounds(W, wedges)
    keep_rows = max(0, min(n, close_to - start + 1))
    P = np.zeros((n, W), int)
    if keep_rows:
        block = roles[:keep_rows].copy()
        pad = np.pad(block != 0, ((0, 0), (6, 6)), mode="wrap" if wrap_x else "edge")
        lab, _ = ndi.label(pad)
        keep = np.unique(lab[0][lab[0] > 0])
        P[:keep_rows] = np.where(np.isin(lab[:, 6:6 + W], keep), block, 0)
    return P

def crown_at(P, r, c, start):
    return P[r - start, P.shape[1] - c]

def stats(roles, ds=None, crown_pairs=0, crown_ds=0, ds_faces=2, yd_per_pair=0.0195):
    """ds_faces=1 for outside-only duplicate stitch (always for 4-6 colours)."""
    H, W = roles.shape; k = roles.max() + 1
    cnt = np.bincount(roles.ravel(), minlength=k)
    out = {"design_share": (cnt / cnt.sum()).round(3).tolist(), "pairs": H * W + crown_pairs}
    out["knit_yarn_yd_each"] = round(out["pairs"] * yd_per_pair)
    if ds is not None:
        n = (int(ds.sum()) + crown_ds) * ds_faces
        out["ds_stitches"] = n
        out["ds_yd_range"] = [round(n * yd_per_pair * f) for f in (2, 3)]
    return out

