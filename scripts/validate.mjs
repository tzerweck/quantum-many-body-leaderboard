import fs from "node:fs"; import path from "node:path";
import { leaksIn } from "../checks/cost/scrub.mjs";
import { expectedDof, expectedEinf, vScore, perSiteDivisor, groundStateExact, stochasticExact } from "./units.mjs";
import { FAMILIES } from "./views.mjs";
import { detailIssue } from "./method_names.mjs";
const FAMILY_NAMES = new Set([...FAMILIES.map(([f]) => f), "other"]);
const issues = [], rounding = []; let rows = 0, checkedD = 0, checkedE = 0, checkedV = 0, checkedC = 0, checkedCov = 0, checkedS = 0;
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
      // Symmetry and extrapolation in the detail are written in slots (method_names.mjs).
      const di = typeof r.method_detail === "string" ? detailIssue(r.method_detail) : null;
      if (di) issues.push(`DETAIL ${at}: ${di} in "${r.method_detail}"`);
      // Whether the energy was sampled is read from the source (RULES.md 6): `sampled` is a
      // boolean, stated by the corrections.mjs entry that carries the evidence.
      if (r.sampled !== undefined && (typeof r.sampled !== "boolean" || !(r.corrections || []).some(c => c.field === "sampled" && c.to === r.sampled)))
        issues.push(`SAMPLED ${at}: sampled ${JSON.stringify(r.sampled)} without the corrections entry that states it`);
      if (eD != null && r.dof != null) { checkedD++; if (r.dof !== eD) issues.push(`DOF   ${at}: stored ${r.dof}, expected ${eD}`); }
      if (eE != null && r.einf != null) { checkedE++; if (Math.abs(r.einf - eE) > 1e-9 * Math.max(1, Math.abs(eE))) issues.push(`EINF  ${at}: stored ${r.einf}, expected ${eE}`); }
      if (r.v_score != null) { checkedV++;
        const v = vScore(r.energy_variance, r.dof, r.energy, r.einf);
        if (v == null || Math.abs(v - r.v_score) > 1e-9 * v) issues.push(`VSCORE ${at}: stored ${r.v_score}, recomputed ${v}`); }
      // Variational principle: no strict bound may sit below an exact row in the same
      // instance. Every exact row states the ground-state energy: the lowest state of ONE
      // symmetry sector, which an unconstrained variational state may legitimately sit
      // below, is not a row (apply_spectrum.mjs moves it to the instance's `spectrum`,
      // checked below), and a row still carrying one is an issue of its own. Violations
      // within 3 sigma, or under a relative 1e-8 where no error bar is stated, are tolerated
      // and only counted.
      // A stochastic exact energy (sign-problem-free QMC) is exact only within its error bar,
      // so the error bar is required (RULES.md 4).
      if (r.sector && !groundStateExact(r)) issues.push(`SECTOR ${at}: the minimum of sector ${r.sector} is a row, not in the spectrum (apply_spectrum.mjs moves it once the instance has a ground-state row; units.mjs names the sector)`);
      if (stochasticExact(r) && r.sigma == null) issues.push(`SIGMA ${at}: exact (stochastic) row without an error bar "${r.method.slice(0,38)}"`);
      if (r.bound_type === "exact" && perSiteDivisor(inst) != null) {
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
          // How the run evaluated its state (DATA.md, `evaluation`; nqs-v2): positive counts, known rules,
          // stages whose iterations add up to the row's.
          if (c.evaluation != null) {
            const ev = c.evaluation, pos = x => x == null || (typeof x === "number" && x > 0);
            for (const k of ["evaluations_per_amplitude", "proposals_per_sample", "reuse"]) if (!pos(ev[k])) issues.push(`COMPUTE ${at}: evaluation.${k} is ${ev[k]}`);
            if (!(ev.head_parameters == null || (ev.head_parameters >= 0 && (c.parameters == null || ev.head_parameters <= c.parameters)))) issues.push(`COMPUTE ${at}: evaluation.head_parameters ${ev.head_parameters}`);
            if (ev.local_energy != null && !["all", "nonzero"].includes(ev.local_energy)) issues.push(`COMPUTE ${at}: evaluation.local_energy ${ev.local_energy}`);
            if (ev.sr != null && !["dense", "onthefly_dense", "cg", "minsr", "none"].includes(ev.sr.kind)) issues.push(`COMPUTE ${at}: evaluation.sr.kind ${ev.sr.kind}`);
            if (ev.stages != null) {
              if (!Array.isArray(ev.stages) || !ev.stages.length || ev.stages.some(st => !(st.iterations > 0) || !pos(st.samples) || !pos(st.parameters) || !pos(st.evaluations_per_amplitude)))
                issues.push(`COMPUTE ${at}: evaluation.stages malformed`);
              else if (c.iterations != null && ev.stages.reduce((x, st) => x + st.iterations, 0) !== c.iterations)
                issues.push(`COMPUTE ${at}: evaluation.stages add up to ${ev.stages.reduce((x, st) => x + st.iterations, 0)} iterations, the row states ${c.iterations}`);
            }
          }
          if (c.vmc_schedule?.kind === "mvmc") {
            const v = c.vmc_schedule;
            for (const k of ["n_proc", "NVMCSample", "NSROptItrStep", "NMPTrans", "NSPGaussLeg", "n_size", "parameters_real"]) if (!(v[k] > 0) && !(k === "parameters_real" && v[k] == null)) issues.push(`COMPUTE ${at}: vmc_schedule.${k} is ${v[k]}`);
          }
          if (c.circuit_schedule != null) {
            const cs = c.circuit_schedule;
            if (!(cs.gates > 0) || !Array.isArray(cs.runs) || cs.runs.some(x => !(x.projector_terms > 0 && x.iterations > 0))) issues.push(`COMPUTE ${at}: circuit_schedule without gates or runs`);
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
        const leak = leaksIn(JSON.stringify(r));
        if (leak.length) issues.push(`RUN ${at}: names the cluster (${leak.join(", ")}); public text names the hardware only`);
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
    // `qmbl_ed_cost` is instance level (DATA.md): measured, reproducing a stored exact energy,
    // checkable against its committed results file, and naming the CPU, never the cluster.
    if (inst.qmbl_ed_cost != null) {
      const x = inst.qmbl_ed_cost, at = `EDCOST ${inst.instance_id}`;
      for (const k of ["core_hours", "wall_clock", "cores", "cpu", "energy", "reproduces", "sector", "lanczos_steps", "code", "results_file", "commit"])
        if (x[k] == null) issues.push(`${at}: no ${k}`);
      if (!(x.core_hours > 0)) issues.push(`${at}: core_hours ${x.core_hours}`);
      if (!inst.rows.some(r => r.bound_type === "exact" && r.energy === x.reproduces?.energy)) issues.push(`${at}: reproduces no exact row`);
      if (x.results_file && !fs.existsSync(x.results_file)) issues.push(`${at}: results file ${x.results_file} missing`);
      const leak = leaksIn(JSON.stringify(x));
      if (leak.length) issues.push(`${at}: names the cluster (${leak.join(", ")}); public text names the hardware only`);
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
    // `spectrum` is instance level (DATA.md): the minimum of every symmetry sector but the
    // ground state's, each the complete row it was. Beside a ground-state row, exact, naming a
    // sector that is not the ground state's, and no lower than the ground state, which is the
    // minimum over all sectors (tolerated as in the bound check above).
    if (inst.spectrum != null) {
      const gs = inst.rows.filter(groundStateExact);
      if (!Array.isArray(inst.spectrum)) issues.push(`SPECTRUM ${inst.instance_id}: not an array`);
      else {
        if (!gs.length) issues.push(`SPECTRUM ${inst.instance_id}: no ground-state row beside the spectrum`);
        for (const [j, s] of inst.spectrum.entries()) {
          checkedS++;
          const at = `${inst.instance_id}.spectrum[${j}]`;
          if (s.bound_type !== "exact") issues.push(`SPECTRUM ${at}: bound_type ${s.bound_type}`);
          if (!s.sector) issues.push(`SPECTRUM ${at}: no sector`);
          else if (groundStateExact(s)) issues.push(`SPECTRUM ${at}: sector ${s.sector} is the ground state's, which is a row`);
          if (typeof s.energy !== "number" || !s.reference) issues.push(`SPECTRUM ${at}: no energy or no reference`);
          for (const g of gs) {
            if (!(s.energy < g.energy)) continue;
            const gap = g.energy - s.energy, rel = gap / Math.abs(g.energy);
            const refSigma = stochasticExact(g) ? g.sigma : null;
            const sigma = s.sigma != null || refSigma != null ? Math.hypot(s.sigma ?? 0, refSigma ?? 0) : null;
            ((sigma != null ? gap > 3 * sigma : rel > 1e-8) ? issues : rounding).push(
              `SPECTRUM ${at}: sector ${s.sector} at ${s.energy}, below the ground state ${g.energy} (rel ${rel.toExponential(1)})`);
          }
        }
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
console.log(`compute_blocks=${checkedC}  coverage_entries=${checkedCov}  spectrum_entries=${checkedS}`);
console.log(`tolerated bound violations (within 3 sigma, or rel < 1e-8 where neither states one; ignored): ${rounding.length}`);
console.log(issues.length ? `\n${issues.length} ISSUES:\n` + issues.slice(0, 25).join("\n") : "\nall checks pass");
