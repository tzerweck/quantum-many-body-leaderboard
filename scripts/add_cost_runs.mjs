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

// The forward pass of the network, counted from the program JAX traces for it
// (checks/cost/forward_flops.py, forward-flops.json; Tristan, 2026-09-29): nqs-v2 in flops.mjs
// uses it instead of its modelled 2 x parameters x reuse. Attached only where the counted
// network has the run's parameter count.
const FWD_FILE = "checks/cost/forward-flops.json";
const FWD = fs.existsSync(FWD_FILE) ? JSON.parse(fs.readFileSync(FWD_FILE, "utf8")) : null;
// The SR step, counted the same way (checks/cost/sr_flops.py, sr-flops.json; Tristan, 2026-09-29):
// the Jacobian NetKet builds (its "complex" mode for these networks), and the solve of a dense S or
// the set-up of conjugate gradients, whose iterations the runs do not log.
const SR_FILE = "checks/cost/sr-flops.json";
const SRC = fs.existsSync(SR_FILE) ? JSON.parse(fs.readFileSync(SR_FILE, "utf8")) : null;
const srOf = res => {
  const c = SRC?.runs.find(x => x.instance_id === res.instance_id && x.model === res.model && !x.error);
  if (!c) return {};
  if (c.parameters !== res.parameters) { console.log(`  SR count for ${res.instance_id} ${res.model}: ${c.parameters} parameters, the run has ${res.parameters}; not attached`); return {}; }
  const cg = c.cg_iteration_flops != null;
  return { jacobian: c.jacobian_mode, sr_counted: { jacobian_flops_per_step: c.jacobian.flops, solve_flops_per_step: cg ? null : c.solve_flops,
    ...(cg ? { solve_setup_flops_per_step: c.solve_setup_flops, cg_iteration_flops: c.cg_iteration_flops } : {}),
    source: `${SR_FILE}, counted ${SRC.environment.ran_utc.slice(0, 10)} by ${SRC.script} (sha256 ${SRC.script_sha256.slice(0, 12)}) with NetKet ${SRC.environment.netket}, jax ${SRC.environment.jax}` } };
};
const forwardOf = res => {
  const c = FWD?.configurations.find(x => x.instance_id === res.instance_id && x.model === res.model && x.flops_per_configuration > 0);
  if (!c) return undefined;
  if (c.parameters !== res.parameters) { console.log(`  forward count for ${res.instance_id} ${res.model}: ${c.parameters} parameters, the run has ${res.parameters}; not attached`); return undefined; }
  const env = FWD.environment.cpu;
  return { flops_per_configuration: c.flops_per_configuration, transcendentals_per_configuration: c.transcendentals_per_configuration,
    source: `${FWD_FILE}, counted ${env.ran_utc.slice(0, 10)} by ${FWD.script} (sha256 ${FWD.script_sha256.slice(0, 12)}) with NetKet ${env.netket}, jax ${env.jax}` };
};

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
        // How the network was evaluated (DATA.md, `evaluation`; nqs-v2 in flops.mjs): NetKet pads the local
        // energy to every bond; each kept sample follows (kept + discarded per chain) / kept sweeps of N
        // proposals; run_nqs.py builds the RBMs with complex parameters; the SR solve is
        // Cholesky on the dense S, or conjugate gradients whose iteration count the run does not log.
        evaluation: {
          proposals_per_sample: inst.n_sites * (tr.n_samples / tr.n_chains + tr.n_discard_per_chain) / (tr.n_samples / tr.n_chains),
          local_energy: "all", complex: ["rbm", "rbmsymm"].includes(res.model), // the GCNN is complex too, but in NetKet's irreps mode its FLOPs already equal the model's 2 P |G| (verification 2026-09-25)
          sr: /Cholesky/.test(tr.optimizer) ? { kind: "dense" } : { kind: "cg", cg_iterations: null },
          forward_flops: forwardOf(res),
          ...srOf(res),
          code: `NetKet ${sw.netket} (checks/cost/run_nqs.py)`,
        },
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
