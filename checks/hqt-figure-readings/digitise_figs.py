# Digitise Fig. 2(a) and Fig. 3 of arXiv:2607.00398v1 from the figure files in the arXiv
# e-print (sources/2607.00398v1-src/). Axis calibration from tick-label rows / gridlines.
# Run: uv run --quiet --with pillow --with numpy python digitise_figs.py
from PIL import Image
import numpy as np, os
SRC = "<run>/sources/2607.00398v1-src"

def load(name):
    im = np.array(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(int)
    return im[:, :, 0], im[:, :, 1], im[:, :, 2]

# ---------- Fig. 2(a): 8x8 J2 scan, energy (left axis) and variance (right axis) ----------
r, g, b = load("Fig2_Phase_Diagram_8x8.jpg")
red = (r > 150) & (g < 110) & (b < 110)
blue = (b > 120) & (r < 120) & (g < 200)
# calibration (pixel rows of tick labels, measured): left axis -0.500 at y=291, -0.675 at y=1358;
# right axis 0.08 at y=375, 0.00 at y=1373; x: J2=0.0 at 390, J2=0.8 at 1740
E_of = lambda y: -0.500 - (y - 291) * (0.175 / (1358 - 291))
V_of = lambda y: 0.08 - (y - 375) * (0.08 / (1373 - 375))
x_of = lambda j2: 390 + j2 * (1740 - 390) / 0.8
table = {0.0: (-0.6735, 0.0005), 0.2: (-0.6052, 0.0008), 0.4: (-0.5351, 0.0012), 0.45: (-0.5180, 0.0015),
         0.5: (-0.5001, 0.0034), 0.55: (-0.5053, 0.0012), 0.6: (-0.5155, 0.0010), 0.8: (-0.5852, 0.0009)}
def blobs(mask, x):
    col = mask[130:1420, x - 3:x + 4].sum(axis=1)
    ys = [y + 130 for y in range(len(col)) if col[y] >= 5]
    if x < 1000: ys = [y for y in ys if y > 335]          # legend box
    groups = []
    for y in ys:
        if groups and y - groups[-1][-1] <= 4: groups[-1].append(y)
        else: groups.append([y])
    return [(np.mean(gr), len(gr)) for gr in groups]
print("Fig. 2(a): J2 | fig E/N (blue marker) | Table 2 E/N | fig var (red marker) | Table 2 var")
for j2 in table:
    x = int(round(x_of(j2)))
    bl = [c for c, n in blobs(blue, x) if n >= 25]; rd = [c for c, n in blobs(red, x) if n >= 25]
    fe = E_of(bl[0]) if bl else None; fv = V_of(rd[0]) if rd else None
    print(f"  {j2:<4} {'%.4f' % fe if fe is not None else 'hidden':>8}  {table[j2][0]:.4f}   {'%.4f' % fv if fv is not None else '-':>7}   {table[j2][1]:.4f}")
# J2 = 0.5: blue circle hidden under the red square; vertex of the two blue line segments
def centerline(xs):
    pts = []
    for x in xs:
        col = blue[130:1420, x]; ys = [y + 130 for y in range(len(col)) if col[y] and y + 130 < 600]
        if ys: pts.append((x, np.mean(ys)))
    return np.array(pts)
L = centerline(range(1168, 1212)); R = centerline(range(1256, 1300))
pl = np.polyfit(L[:, 0], L[:, 1], 1); pr = np.polyfit(R[:, 0], R[:, 1], 1)
xv = (pr[1] - pl[1]) / (pl[0] - pr[0]); yv = np.polyval(pl, xv)
sub = red[170:230, 1205:1265]; ys, xs = np.nonzero(sub)
print(f"  J2=0.5 blue vertex: x={xv:.1f} (marker column 1234), y={yv:.1f} -> E/N = {E_of(yv):.4f}")
print(f"  J2=0.5 red square centre: y={ys.mean()+170:.1f} -> variance = {V_of(ys.mean()+170):.4f}")
# J2 = 0: blue hidden under red square; red square centre gives the shared y
rd0 = [c for c, n in blobs(red, 390) if n >= 25]
print(f"  J2=0.0 marker y={rd0[0]:.1f} -> E/N = {E_of(rd0[0]):.4f} (1 px = {0.175/(1358-291):.2e}), variance = {V_of(rd0[0]):.4f}")
# autoscale cross-check: matplotlib 5% margins; frame top y~143, bottom y~1406
print(f"  autoscale check: frame top y=143 -> E={E_of(143):.4f}; data max = (E_top + 0.05*E_min)/1.05 with E_min=-0.6735: {(E_of(143)+0.05*(-0.6735))/1.05:.4f}")

# ---------- Fig. 3: 10x10 J2=0.5 optimisation traces ----------
r, g, b = load("Fig3_Transfer_10x10.jpg")
red = (r > 170) & (g < 100) & (b < 100)
blue = (b > 150) & (r < 120) & (g > 80) & (g < 190)
# calibration: gridlines -0.490 at y=736, -0.498 at y=1515; x: iter 0 at 440, iter 100 at 2603
E3 = lambda y: -0.490 - (y - 736) / ((1515 - 736) / 0.008)
xi = lambda i: 440 + i * (2603 - 440) / 100.0
def trace(mask):
    out = {}
    for i in range(0, 112):
        x = int(round(xi(i))); sub = mask[150:1560, x - 5:x + 6]; ys, _ = np.nonzero(sub)
        if len(ys) >= 20: out[i] = E3(150 + ys.mean())
    return out
tr, cs = trace(red), trace(blue)
legend = set(range(65, 70))   # legend box overlaps these columns
tail = [tr[i] for i in range(80, 110) if i in tr and i not in legend]
print("Fig. 3: transfer trace, iterations 0..109 (110 points); legend artefacts at 65-69 excluded")
print(f"  tail 80-109: n={len(tail)} mean={np.mean(tail):.6f} std={np.std(tail):.1e} min={min(tail):.6f} max={max(tail):.6f} last(109)={tr[109]:.6f}")
print(f"  first point (zero-shot, iter 0) = {tr[0]:.5f}; at iter 50 = {tr[50]:.5f}")
ct = [cs[i] for i in range(80, 110) if i in cs]
print(f"  cold-start tail 80-109: mean={np.mean(ct):.5f} last={cs[109]:.5f}")
print(f"  dashed reference line y=1484.5 -> {E3(1484.5):.6f} (Chen & Heyl -0.4976921); 1 px = {0.008/(1515-736):.1e}")
