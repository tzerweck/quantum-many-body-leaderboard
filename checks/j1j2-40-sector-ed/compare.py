#!/usr/bin/env python3
"""E1 validation gate: ed40.py against (1) bf_check.py on the 20-site C4 cluster (energies and sector dimensions) and
(2) QMBL's stored 6x6 exact rows (J1J2/square_36_P_*, Pauli totals) plus VE's ed_sym B1 value at J2 = 0.65.
Exit 0 only if every comparison passes."""
import glob, json, os, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D20 = sys.argv[1] if len(sys.argv) > 1 else "results/v20"
D36 = sys.argv[2] if len(sys.argv) > 2 else "results/v36"
ok = True


def check(label, got, ref, tol_rel):
    global ok
    d = abs(got - ref); rel = d / abs(ref)
    good = rel <= tol_rel
    ok &= good
    print(f"  {'PASS' if good else 'FAIL'} {label}: ed40 {got!r} ref {ref!r} |d| {d:.2e} rel {rel:.1e}")


def load(dirn):
    out = {}
    for f in glob.glob(os.path.join(R, dirn, "*__J2_*.json")):
        if f.endswith("__vec.npy"):
            continue
        d = json.load(open(f)); out[(d["sector"][0], round(d["J2"], 6))] = d
    return out


def quality(d):
    global ok
    good = d["residual"] < 1e-7 and d["converged"] and d["notfound_targets"] == 0 and (d["hermiticity_rel"] is None or d["hermiticity_rel"] < 1e-11)
    ok &= good
    if not good:
        print(f"  FAIL quality {d['sector']} J2={d['J2']}: residual {d['residual']:.1e} converged {d['converged']} notfound {d['notfound_targets']} herm {d['hermiticity_rel']}")


print(f"== dirs {D20} {D36}")
print("== 20-site C4 cluster (4,2),(-2,4): ed40 vs bf_check (full S^z=0 space, explicit projector)")
bf = json.load(open(os.path.join(R, "results/v20/bf20.json")))
e20 = load(D20)
if not e20:
    print("  FAIL no ed40 20-site results"); ok = False
else:
    any20 = next(iter(e20.values()))
    for s in ("A", "B"):
        good = any20["dim_" + s] == bf["dims"][s]; ok &= good
        print(f"  {'PASS' if good else 'FAIL'} dim {s}+: ed40 {any20['dim_' + s]} bf {bf['dims'][s]}")
    for (s, j2), d in sorted(e20.items()):
        row = next(r for r in bf["results"] if abs(r["J2"] - j2) < 1e-9)
        check(f"{s}+ J2={j2}", d["E"], row[s], 1e-10); quality(d)
        lead = "A" if row["A"] < row["B"] else "B"
    for r in bf["results"]:
        print(f"     bf J2={r['J2']}: A+ {r['A']:.12f} B+ {r['B']:.12f} full-space GS {r['E_full_space']:.12f}")

print("== 6x6 (C4 subgroup): ed40 vs stored exact rows (Pauli totals) and VE ed_sym B1 at 0.65")
ref36 = {("A", 0.6): -71.026357467734, ("A", 0.65): -72.9486516516581, ("B", 0.65): -72.94778724308212,
         ("B", 0.7): -76.320176597454, ("B", 0.8): -84.45407039473, ("B", 0.9): -93.463489624054, ("B", 1.0): -102.867902314985}
e36 = load(D36)
if len(e36) < len(ref36):
    print(f"  FAIL only {len(e36)} 6x6 results"); ok = False
for kk, ref in ref36.items():
    if kk in e36:
        check(f"{kk[0]}+ J2={kk[1]}", e36[kk]["E"], ref, 1e-10); quality(e36[kk])
if e36:
    any36 = next(iter(e36.values()))
    for s, ref in (("A", 31546500), ("B", 31546337)):
        good = any36["dim_" + s] == ref; ok &= good
        print(f"  {'PASS' if good else 'FAIL'} dim {s}+: ed40 {any36['dim_' + s]} expected {ref} (C4v A1+A2 / B1+B2 from VE)")
print("GATE", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
