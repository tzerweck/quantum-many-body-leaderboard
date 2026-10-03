#!/usr/bin/env python3
"""E1 gate for queue c: ed40b.py --group c2 on the 20-site C4 cluster (4,2),(-2,4) against bf_check.py --sectors A,B,E
(full S^z=0 space, explicit projector). C2 sector B (pi rotation -> -1) must equal bf's E (energies 1e-10 relative,
dimension exact); C2 sector A must equal min(bf A, bf B). Exit 0 only if every comparison passes."""
import glob, json, os, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = sys.argv[1] if len(sys.argv) > 1 else "results/v20c"
ok = True


def check(label, got, ref, tol_rel):
    global ok
    d = abs(got - ref); rel = d / abs(ref)
    good = rel <= tol_rel
    ok &= good
    print(f"  {'PASS' if good else 'FAIL'} {label}: ed40b {got!r} ref {ref!r} |d| {d:.2e} rel {rel:.1e}")


def quality(d):
    global ok
    good = d["residual"] < 1e-7 and d["converged"] and d["notfound_targets"] == 0 and (d["hermiticity_rel"] is None or d["hermiticity_rel"] < 1e-11)
    ok &= good
    if not good:
        print(f"  FAIL quality {d['sector']} J2={d['J2']}: residual {d['residual']:.1e} converged {d['converged']} notfound {d['notfound_targets']} herm {d['hermiticity_rel']}")


bf = json.load(open(os.path.join(R, D, "bf20e.json")))
res = {}
for f in glob.glob(os.path.join(R, D, "sq20c2__*__J2_*.json")):
    d = json.load(open(f)); res[(d["sector"][0], round(d["J2"], 6))] = d
print(f"== {D}: ed40b c2 20-site vs bf_check (dims {bf['dims']})")
if not res:
    print("  FAIL no ed40b c2 results"); ok = False
else:
    any20 = next(iter(res.values()))
    for s, ref in (("A", bf["dims"]["A"] + bf["dims"]["B"]), ("B", bf["dims"]["E"])):
        good = any20["dim_" + s] == ref; ok &= good
        print(f"  {'PASS' if good else 'FAIL'} dim C2 {s}: ed40b {any20['dim_' + s]} expected {ref}")
    for (s, j2), d in sorted(res.items()):
        row = next(r for r in bf["results"] if abs(r["J2"] - j2) < 1e-9)
        ref = row["E"] if s == "B" else min(row["A"], row["B"])
        check(f"C2 {s} J2={j2}", d["E"], ref, 1e-10); quality(d)
    for r in bf["results"]:
        print(f"     bf J2={r['J2']}: A+ {r['A']:.12f} B+ {r['B']:.12f} E {r['E']:.12f} full-space GS {r['E_full_space']:.12f}")
print("GATE_C", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
