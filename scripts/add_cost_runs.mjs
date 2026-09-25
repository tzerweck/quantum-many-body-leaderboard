// QMBL's own cost-to-reproduce runs (checks/cost/README.md), one row per results file and
// one per DMRG rung, with `computed_by: "qmbl"` (DATA.md). A run is a row of its own: it is
// QMBL's implementation, hyperparameters and budget, and is never attached to anyone else's
// row. Every compute field is measured, in the run's process, and `reported_as` quotes the
// results file's values so the block can be checked from a clone.
import fs from "node:fs";
import path from "node:path";
import { expectedDof, expectedEinf, vScore } from "./units.mjs";

const DIR = "checks/cost/results";
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith(".json")).sort() : [];
let added = 0;

const two = x => (x == null ? null : +x.toPrecision(2));

// Protocol v1.4 (checks/cost/README.md): what the hardware was doing, from the results file's
// `resources` block, as one sentence for the compute note; empty for an older results file.
const resourcesSaid = x => {
  if (!x) return "";
  const ghz = v => (v / 1000).toFixed(2);
  const parts = [`process CPU time ${(x.process_cpu_seconds / 3600).toFixed(2)} h, ${Math.round(100 * x.cpu_utilisation)} % of wall-clock x ${x.cores} cores`];
  if (x.core_mhz) parts.push(`cores at ${ghz(x.core_mhz.mean)} GHz on average (${ghz(x.core_mhz.min)}-${ghz(x.core_mhz.max)}${x.core_max_mhz ? `, max ${ghz(x.core_max_mhz)}` : ""})`);
  if (x.node_load) parts.push(`node load ${x.node_load.mean} on average of ${x.node_cpus} CPUs`);
  if (x.gpu?.sm_mhz) parts.push(`GPU SM clock ${Math.round(x.gpu.sm_mhz.mean)} MHz on average (max ${x.gpu.sm_max_mhz}), utilisation ${x.gpu.utilisation_percent?.mean} %, ${x.gpu.power_watts?.mean} W`);
  return ` Hardware during the run (sampled every ${x.sample_period_seconds} s): ${parts.join("; ")}.`;
};
// A size-ladder run on the H100 host (README, amendment v1.5) is a second protocol for hours: its
// method string says so, and it names no Slurm job because the host has no scheduler.
const label = (r, f) => `${r.label}, QMBL cost-to-reproduce run${/^h100-/.test(f || "") ? ", H100 size ladder" : ""}`;
const jobOf = h => (h.slurm_job_id ? `Slurm job ${h.slurm_job_id}` : "no scheduler");

for (const f of files) {
  let res;
  try { res = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { console.log(`SKIP ${f}: ${e.message.slice(0, 60)}`); continue; }
  const p = `data/${res.instance_id}.json`;
  if (!fs.existsSync(p)) { console.log(`SKIP ${f}: no instance ${res.instance_id}`); continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const dof = expectedDof(inst), einf = expectedEinf(inst);
  const day = (res.timing?.ended_utc || "").slice(0, 10);
  const rel = `checks/cost/results/${f}`;
  const rows = [];

  if (res.schema === "qmbl-cost-run-1") {
    const { hardware: h, timing: t, train: tr, software: sw } = res;
    if (!Number.isFinite(res.energy) || !Number.isFinite(res.sigma) || res.diverged) { console.log(`SKIP ${f}: energy ${res.energy} sigma ${res.sigma} (a run that diverged is not a row)`); continue; }
    if (!(res.r_hat < 1.05)) { console.log(`SKIP ${f}: R_hat ${res.r_hat} (the final evaluation's chains had not equilibrated; not a row)`); continue; }
    const recovered = (res.recoveries || []).map(r => `energy ${r.energy == null ? "not finite" : r.energy.toPrecision(3)} at step ${r.step}${r.energy == null ? "" : ", outside the Hamiltonian's bound"}, parameters restored from step ${r.restored_from}${r.restored_energy == null ? "" : ` (E = ${r.restored_energy.toFixed(2)})`}, learning rate ${r.lr} from there`).join("; ");
    const chains = res.eval.chains_from === "training" ? "the training chains carried on" : "fresh chains";
    const device = h.device_kind.replace(/^NVIDIA /, "NVIDIA ");
    const gpuHours = t.wall_seconds / 3600 * h.n_devices;
    const said = `energy ${res.energy} sigma ${res.sigma} energy_variance ${res.energy_variance} tau_corr ${res.tau_corr} r_hat ${res.r_hat} | ` +
      `wall_hms ${t.wall_hms} (wall_seconds ${t.wall_seconds}) on ${h.n_devices} x ${h.device_kind}, ${h.host}, ${jobOf(h)} | ` +
      `parameters ${res.parameters}, steps ${tr.steps} x n_samples ${tr.n_samples}, eval samples ${res.eval.samples}`;
    rows.push({
      energy: res.energy, sigma: two(res.sigma), energy_variance: res.energy_variance, dof, einf,
      v_score: vScore(res.energy_variance, dof, res.energy, einf),
      method: label(res, f),
      bound_type: "variational",
      bound_type_reason: "variational Monte Carlo energy of a normalised ansatz, evaluated by QMBL on the trained state with its error bar; a strict upper bound within that bar",
      reference: `QMBL, checks/cost/ (cost-to-reproduce run ${f.replace(/\.json$/, "")}, Slurm job ${h.slurm_job_id}, commit ${sw.commit})`,
      peer_reviewed: false, source: `qmbl-cost-${day}`, provenance: "primary", computed_by: "qmbl",
      verified: { checked_on: day, method: `${sw.script} (NetKet ${sw.netket}, jax ${sw.jax}) on ${h.n_devices} x ${h.device_kind}, protocol checks/cost/README.md`,
        reported_as: said,
        note: `Final evaluation, ${chains}: ${res.eval.samples} samples, ${res.eval.chains} chains, ${res.eval.discard_per_chain} discarded per chain; ` +
          `tau_corr ${res.tau_corr.toFixed(2)}, R_hat ${res.r_hat.toFixed(3)}. Trained ${tr.steps} steps of ${tr.optimizer}, lr ${tr.lr}${tr.warmup_steps ? ` after a ${tr.warmup_steps}-step linear warmup` : ""}, ` +
          `${tr.n_samples} samples per step, ${tr.sampler}, seed ${tr.seed}.${recovered ? ` Divergence rule applied: ${recovered}.` : ""} Per-step trace and final parameters beside the results file.`,
        secondary_of: null },
      compute: {
        parameters: res.parameters, gpu_hours: +gpuHours.toFixed(3), device, n_devices: h.n_devices, samples: tr.n_samples,
        wall_clock: t.wall_hms, cpu_core_hours: null, bond_dimension: null, iterations: tr.steps,
        reported_as: said,
        source: `${rel}, ${jobOf(h)} on ${h.host}, commit ${sw.commit} (QMBL run, ${day})`,
        scope: "row", confidence: "high",
        note: `Measured, not reported: wall-clock from process start to the end of the final evaluation, JIT compilation and sampling included ` +
          `(setup ${t.setup_seconds.toFixed(0)} s, training ${t.train_seconds.toFixed(0)} s, evaluation ${t.eval_seconds.toFixed(0)} s); gpu_hours = wall-clock x ${h.n_devices} GPU.` + resourcesSaid(res.resources) +
          (res.best_of?.runs > 1 ? ` The best of ${res.best_of.runs} runs of this configuration under the protocol (lowest final energy; checks/cost/best_run.mjs).` : ""),
      },
    });
  } else if (res.schema === "qmbl-cost-run-dmrg-1") {
    const { hardware: h, software: sw } = res;
    const maxdim = [];
    for (const rung of res.rungs) {
      // The schedule that reached this rung: every sweep of the rungs below it, then its own
      // (dmrg-v1 in flops.mjs); TeNPy logs its MPO, so the model needs no lattice.
      maxdim.push(...Array(rung.sweeps).fill(rung.chi_max));
      const schedule = { code: `TeNPy ${sw.tenpy}`, eigensolver_applications: rung.lanczos?.lanczos_updates ? +(rung.lanczos.applications / rung.lanczos.lanczos_updates).toFixed(2) : null,
        eigensolver_source: rung.lanczos?.lanczos_updates ? `measured: ${rung.lanczos.applications} Lanczos applications over ${rung.lanczos.lanczos_updates} Lanczos updates in this rung (${rung.lanczos.full_diagonalisations} more by full diagonalisation)` : "not recorded by this run (TeNPy's Lanczos stops adaptively)",
        maxdim: [...maxdim], start: "Neel product state", cutoff: res.protocol.svd_min, variance_after: [],
        lattice: { order: "tenpy", n_sites: inst.n_sites, mpo_bond_dimension: res.protocol.mpo_bond_dimension, site_dimension: 2, operators_per_bond: 3 } };
      const said = `chi_max ${rung.chi_max} chi_reached ${rung.chi_reached} energy ${rung.energy} (energy_SS ${rung.energy_SS}) sweeps ${rung.sweeps} max_trunc_err ${rung.max_trunc_err} | ` +
        `wall_hms ${rung.wall_hms} (wall_seconds ${rung.wall_seconds}) on ${res.cores} cores, ${h.host}, ${jobOf(h)} | cpu_core_hours ${rung.cpu_core_hours}`;
      rows.push({
        energy: rung.energy, sigma: null, energy_variance: null, dof, einf, v_score: null,
        method: `DMRG (chi = ${rung.chi_max}), QMBL cost-to-reproduce run`,
        bound_type: "variational",
        bound_type_reason: "finite-bond-dimension DMRG energy computed by QMBL; a variational upper bound",
        reference: `QMBL, checks/cost/ (cost-to-reproduce run ${f.replace(/\.json$/, "")}, Slurm job ${h.slurm_job_id}, commit ${sw.commit})`,
        peer_reviewed: false, source: `qmbl-cost-${day}`, provenance: "primary", computed_by: "qmbl",
        verified: { checked_on: day, method: `${sw.script} (TeNPy ${sw.tenpy}) on ${res.cores} cores, protocol checks/cost/README.md`,
          reported_as: said,
          note: `${res.protocol.algorithm}; MPO bond dimension ${res.protocol.mpo_bond_dimension}; converged at ${res.protocol.max_E_err} in the energy or ${res.protocol.max_sweeps} sweeps. ` +
            `Energy computed in S.S units and stored x4 (Pauli, the instance's convention).`,
          secondary_of: null },
        compute: {
          parameters: null, gpu_hours: null, device: h.cpu, n_devices: null, samples: null,
          wall_clock: rung.wall_hms, cpu_core_hours: +rung.cpu_core_hours.toFixed(3), bond_dimension: rung.chi_max, iterations: rung.sweeps,
          sweep_schedule: schedule,
          reported_as: said,
          source: `${rel}, ${jobOf(h)} on ${h.host}, commit ${sw.commit} (QMBL run, ${day})`,
          scope: "row", confidence: "high",
          note: `Measured, not reported: wall-clock from process start to the end of this rung, the rungs below it included; cpu_core_hours = wall-clock x ${res.cores} allocated cores. ` +
            `iterations is the sweep count of this rung alone; sweep_schedule lists every sweep of the process up to the end of this rung, which is what the hours cover.` + resourcesSaid(rung.resources),
        },
      });
    }
  } else { console.log(`SKIP ${f}: schema ${res.schema}`); continue; }

  inst.rows.push(...rows);
  added += rows.length;
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`cost runs: ${added} rows from ${files.length} results files`);
