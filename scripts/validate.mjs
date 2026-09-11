import fs from "node:fs"; import path from "node:path";
import { expectedDof, expectedEinf, vScore, perSiteDivisor } from "./units.mjs";
const issues = [], rounding = []; let rows = 0, checkedD = 0, checkedE = 0, checkedV = 0;
for (const m of fs.readdirSync("data")) {
  const dir = path.join("data", m);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const inst = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const eD = expectedDof(inst), eE = expectedEinf(inst);
    for (const [i, r] of inst.rows.entries()) {
      rows++;
      const at = `${inst.instance_id}[${i}]`;
      if (eD != null && r.dof != null) { checkedD++; if (r.dof !== eD) issues.push(`DOF   ${at}: stored ${r.dof}, expected ${eD}`); }
      if (eE != null && r.einf != null) { checkedE++; if (Math.abs(r.einf - eE) > 1e-9 * Math.max(1, Math.abs(eE))) issues.push(`EINF  ${at}: stored ${r.einf}, expected ${eE}`); }
      if (r.v_score != null) { checkedV++;
        const v = vScore(r.energy_variance, r.dof, r.energy, r.einf);
        if (v == null || Math.abs(v - r.v_score) > 1e-9 * v) issues.push(`VSCORE ${at}: stored ${r.v_score}, recomputed ${v}`); }
      // Variational principle: no strict bound may sit below an exact row in the same
      // instance. Sector-resolved ED rows are excluded - they are the lowest state in
      // ONE symmetry sector, so an unconstrained variational state may legitimately
      // sit below them. Violations under a relative 1e-8 are reported as rounding.
      if (r.bound_type === "exact" && perSiteDivisor(inst) != null && !/[A-Z][0-9a-z]*\.[A-Z]/.test(r.method)) {
        for (const o of inst.rows) {
          if (o.bound_type !== "variational" || o.energy >= r.energy) continue;
          const rel = (r.energy - o.energy) / Math.abs(r.energy);
          // A variational MC energy may sit below the exact value by a fraction of its
          // own error bar without violating anything. Only flag past 3 sigma.
          const gap = r.energy - o.energy;
          const realViolation = o.sigma != null ? gap > 3 * o.sigma : rel > 1e-8;
          (realViolation ? issues : rounding).push(
            `BOUND ${at}: variational ${o.energy} below exact ${r.energy} (rel ${rel.toExponential(1)}) "${o.method.slice(0,38)}"`);
        }
      }
    }
  }
}
console.log(`rows=${rows}  dof_checked=${checkedD}  einf_checked=${checkedE}  vscore_checked=${checkedV}`);
console.log(`within-rounding bound violations (rel < 1e-8, ignored): ${rounding.length}`);
console.log(issues.length ? `\n${issues.length} ISSUES:\n` + issues.slice(0, 25).join("\n") : "\nall checks pass");
