import fs from "node:fs"; import path from "node:path";
import { expectedDof, expectedEinf, vScore, perSiteDivisor, groundStateExact, stochasticExact } from "./units.mjs";
import { FAMILIES } from "./views.mjs";
const FAMILY_NAMES = new Set([...FAMILIES.map(([f]) => f), "other"]);
const issues = [], rounding = []; let rows = 0, checkedD = 0, checkedE = 0, checkedV = 0, checkedC = 0, checkedCov = 0;
for (const m of fs.readdirSync("data")) {
  const dir = path.join("data", m);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const inst = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const eD = expectedDof(inst), eE = expectedEinf(inst);
    for (const [i, r] of inst.rows.entries()) {
      rows++;
      const at = `${inst.instance_id}[${i}]`;
      // Every row is named (scripts/method_names.mjs): a short name, a detail that may be
      // empty, the published string, and a family the figures know.
      if (!r.method || typeof r.method_detail !== "string" || !r.method_as_published)
        issues.push(`METHOD ${at}: not named, published "${r.method_as_published ?? r.method}" (add it to scripts/method_names.mjs)`);
      else if (!FAMILY_NAMES.has(r.family)) issues.push(`FAMILY ${at}: "${r.family}" for "${r.method}"`);
      if (eD != null && r.dof != null) { checkedD++; if (r.dof !== eD) issues.push(`DOF   ${at}: stored ${r.dof}, expected ${eD}`); }
      if (eE != null && r.einf != null) { checkedE++; if (Math.abs(r.einf - eE) > 1e-9 * Math.max(1, Math.abs(eE))) issues.push(`EINF  ${at}: stored ${r.einf}, expected ${eE}`); }
      if (r.v_score != null) { checkedV++;
        const v = vScore(r.energy_variance, r.dof, r.energy, r.einf);
        if (v == null || Math.abs(v - r.v_score) > 1e-9 * v) issues.push(`VSCORE ${at}: stored ${r.v_score}, recomputed ${v}`); }
      // Variational principle: no strict bound may sit below an exact row in the same
      // instance. Sector-resolved ED rows are excluded - they are the lowest state in
      // ONE symmetry sector, so an unconstrained variational state may legitimately
      // sit below them. Violations within 3 sigma, or under a relative 1e-8 where no error
      // bar is stated, are tolerated and only counted.
      // A stochastic exact energy (sign-problem-free QMC) is exact only within its error bar,
      // so the error bar is required (RULES.md 4).
      if (stochasticExact(r) && r.sigma == null) issues.push(`SIGMA ${at}: exact (stochastic) row without an error bar "${r.method.slice(0,38)}"`);
      if (groundStateExact(r) && perSiteDivisor(inst) != null) {
        // A stochastic exact reference carries an error bar of its own; the two combine.
        const refSigma = stochasticExact(r) ? r.sigma : null;
        for (const o of inst.rows) {
          if (o.bound_type !== "variational" || o.energy >= r.energy) continue;
          const rel = (r.energy - o.energy) / Math.abs(r.energy);
          // A variational MC energy may sit below the exact value by a fraction of the
          // combined error bar without violating anything. Only flag past 3 sigma.
          const gap = r.energy - o.energy;
          const sigma = o.sigma != null || refSigma != null ? Math.hypot(o.sigma ?? 0, refSigma ?? 0) : null;
          const realViolation = sigma != null ? gap > 3 * sigma : rel > 1e-8;
          (realViolation ? issues : rounding).push(
            `BOUND ${at}: variational ${o.energy} below ${stochasticExact(r) ? "exact (stochastic)" : "exact"} ${r.energy} (rel ${rel.toExponential(1)}) "${o.method.slice(0,38)}"`);
        }
      }
      // `compute` is self-reported and unfalsifiable, so what the validator can check is
      // that it says where it came from and that nothing normalised has crept in: an
      // "H100-equivalent" column would be an argument, not a measurement (DATA.md).
      if (r.compute != null) {
        checkedC++;
        const c = r.compute;
        if (typeof c !== "object" || Array.isArray(c)) issues.push(`COMPUTE ${at}: not an object`);
        else {
          if (!c.reported_as) issues.push(`COMPUTE ${at}: no reported_as, so the number cannot be checked against the paper`);
          // Zero parameters is a statement (a projected wavefunction with nothing to fit); zero
          // hours or samples is not.
          for (const k of ["parameters", "gpu_hours", "n_devices", "samples", "cpu_core_hours", "bond_dimension", "iterations"])
            if (c[k] != null && !(typeof c[k] === "number" && (c[k] > 0 || (k === "parameters" && c[k] === 0))))
              issues.push(`COMPUTE ${at}: ${k} is ${c[k]}`);
          if (c.gpu_hours != null && !c.device) issues.push(`COMPUTE ${at}: gpu_hours without a device model`);
          // A DMRG run's schedule (DATA.md, `sweep_schedule`): one maximum bond dimension per
          // sweep, at least the sweeps the row counts, variance evaluations inside the run.
          if (c.sweep_schedule != null) {
            const s = c.sweep_schedule;
            if (!Array.isArray(s.maxdim) || !s.maxdim.length || s.maxdim.some(m => !(Number.isInteger(m) && m > 0)))
              issues.push(`COMPUTE ${at}: sweep_schedule.maxdim is not a list of bond dimensions`);
            else {
              if (c.iterations == null || s.maxdim.length < c.iterations) issues.push(`COMPUTE ${at}: sweep_schedule has ${s.maxdim.length} sweeps, iterations ${c.iterations}`);
              if ((s.variance_after || []).some(k => !(Number.isInteger(k) && k >= 1 && k <= s.maxdim.length))) issues.push(`COMPUTE ${at}: sweep_schedule.variance_after outside the run`);
            }
            if (!(s.eigensolver_applications == null || s.eigensolver_applications > 0) || !s.eigensolver_source) issues.push(`COMPUTE ${at}: sweep_schedule eigensolver setting without its source`);
            if (!s.code || !s.lattice || !["chain", "snake", "edges", "itensor-triangular", "tenpy"].includes(s.lattice.order) || !(s.lattice.site_dimension > 1))
              issues.push(`COMPUTE ${at}: sweep_schedule without code or a lattice order the FLOP model knows`);
          }
          for (const k of Object.keys(c))
            if (/normali[sz]ed|equivalent|h100_eq/i.test(k)) issues.push(`COMPUTE ${at}: normalised field ${k}; DATA.md forbids normalisation`);
        }
      }
      // A row QMBL computed itself (DATA.md, `computed_by`) must name its run and carry the
      // measured cost that is its reason to exist; anything else claiming the field is wrong.
      if (r.computed_by != null) {
        if (r.computed_by !== "qmbl") issues.push(`RUN ${at}: computed_by ${r.computed_by}`);
        if (!/checks\/cost\//.test(r.reference || "")) issues.push(`RUN ${at}: reference does not name checks/cost/`);
        if (r.baseline) issues.push(`RUN ${at}: both computed_by and baseline`);
        const c = r.compute;
        if (!c || (c.gpu_hours == null && c.cpu_core_hours == null) || !c.device || c.scope !== "row" || !/checks\/cost\/results\//.test(c.source || ""))
          issues.push(`RUN ${at}: QMBL run without a measured compute block (hours, device, scope row, results file)`);
        if (!r.verified?.reported_as) issues.push(`RUN ${at}: QMBL run without verified.reported_as`);
      }
      // An error bar or variance the paper does not print must say who produced it and be
      // checkable against a committed file (DATA.md, the `error_metrics` block).
      if (r.error_metrics != null) {
        const m = r.error_metrics;
        if (!["authors", "qmbl"].includes(m.measured_by)) issues.push(`ERRMET ${at}: measured_by ${m.measured_by}`);
        if (!Array.isArray(m.fields) || !m.fields.length || m.fields.some(k => r[k] == null))
          issues.push(`ERRMET ${at}: fields ${JSON.stringify(m.fields)} not all set on the row`);
        const text = m.source_file && fs.existsSync(m.source_file) ? fs.readFileSync(m.source_file, "utf8") : null;
        if (text == null) issues.push(`ERRMET ${at}: source_file ${m.source_file} missing`);
        else if (!m.reported_as || m.reported_as.split(" | ").some(s => !text.includes(s)))
          issues.push(`ERRMET ${at}: reported_as not verbatim in ${m.source_file}`);
      }
    }
    // `coverage` is instance level: when its literature was last checked and by what.
    // A check that found nothing is as real as one that added a row, so `found: 0` is
    // valid and is what an instance page needs in order not to read as authoritative.
    if (inst.coverage != null) {
      if (!Array.isArray(inst.coverage)) issues.push(`COVERAGE ${inst.instance_id}: not an array`);
      else for (const [j, c] of inst.coverage.entries()) {
        checkedCov++;
        const at = `${inst.instance_id}.coverage[${j}]`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checked_on || "")) issues.push(`COVERAGE ${at}: checked_on ${c.checked_on}`);
        if (!c.method) issues.push(`COVERAGE ${at}: no method`);
        if (!Number.isInteger(c.found) || c.found < 0) issues.push(`COVERAGE ${at}: found ${c.found}`);
        if (!Array.isArray(c.screened) && !Number.isInteger(c.screened_count))
          issues.push(`COVERAGE ${at}: neither a screened list nor a screened_count`);
      }
    }
  }
}
// The TFIsing unit convention, asserted rather than assumed.
//
// Grouping TFIsing with the Heisenberg models put it on the 4*N divisor, so every
// per-site energy in that family read a factor of 4 too small and no literature value
// could ever match one - most of why the family shows 0 of 7 instances covered. The
// convention is not a matter of opinion here: the transverse-field Ising CHAIN is
// exactly solvable, so the stored number can be derived. H = -sum s^z s^z - h sum s^x
// with PBC has ground state -sum_k 2 sqrt(h^2 - 2h cos k + 1) over the antiperiodic
// momenta k = pi(2n+1)/N. If that stops reproducing the stored `exact` rows, either the
// convention or the reference data has moved, and both are worth stopping for.
const tfisingExactPBC = (N, h) => {
  let E = 0;
  for (let n = 0; n < N / 2; n++) {
    const k = Math.PI * (2 * n + 1) / N;
    E -= 2 * Math.sqrt(h * h - 2 * h * Math.cos(k) + 1);
  }
  return E;
};
let checkedT = 0;
for (const f of fs.readdirSync(path.join("data", "TFIsing"))) {
  const inst = JSON.parse(fs.readFileSync(path.join("data", "TFIsing", f), "utf8"));
  if (inst.lattice !== "chain" || inst.boundary !== "P") continue;
  const ex = inst.rows.find(r => r.bound_type === "exact");
  if (!ex) continue;
  checkedT++;
  const want = tfisingExactPBC(inst.n_sites, inst.params.h);
  if (Math.abs(ex.energy - want) > 1e-9 * Math.abs(want))
    issues.push(`TFCONV ${inst.instance_id}: exact row ${ex.energy}, free-fermion ${want}`);
  if (perSiteDivisor(inst) !== inst.n_sites)
    issues.push(`TFCONV ${inst.instance_id}: perSiteDivisor ${perSiteDivisor(inst)}, expected ${inst.n_sites} (Pauli convention)`);
}

console.log(`rows=${rows}  dof_checked=${checkedD}  einf_checked=${checkedE}  vscore_checked=${checkedV}  tfising_exact_checked=${checkedT}`);
console.log(`compute_blocks=${checkedC}  coverage_entries=${checkedCov}`);
console.log(`tolerated bound violations (within 3 sigma, or rel < 1e-8 where neither states one; ignored): ${rounding.length}`);
console.log(issues.length ? `\n${issues.length} ISSUES:\n` + issues.slice(0, 25).join("\n") : "\nall checks pass");
