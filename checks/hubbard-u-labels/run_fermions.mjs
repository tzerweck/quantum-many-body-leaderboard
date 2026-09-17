// Fermion ED for the E1 Hubbard and t-V rows (canonical ensemble, no spatial symmetry).
//   node run_fermions.mjs <instance> [...]      results -> results/<instance>.json
// Hubbard: H = -sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_iup n_idn, N_up = N_dn = Nf   (vendor/varbench/Hubbard/README.md, ham.py Hubbard)
// t-V:     H = -sum_<ij> (c+_i c_j + h.c.) + V sum_<ij> n_i n_j, Nf total                 (vendor/varbench/tV/README.md, ham.py tVModel)
// Graph: nk.graph.Grid(extent, pbc) as in vmc.py get_ham.
import fs from "node:fs";
import { lanczos, spinfulOperator, spinlessOperator, hoppingTerms, gridEdges, popcount } from "./ed_lib.mjs";

const RES = new URL("./results/", import.meta.url);
fs.mkdirSync(RES, { recursive: true });

// argument form: <instance> or <instance>@<U>, the latter evaluating the same lattice/filling at a different
// interaction than the instance name carries (for the "label U vs logspace-grid U" question).
for (const arg of process.argv.slice(2)) {
  const t0 = Date.now();
  const [instance, uOverride] = arg.split("@");
  const [model, rest] = instance.split("/");
  const m = rest.match(/^(chain|square)_(\d+)_P_(\d+)_([0-9.]+)$/);
  if (!m) throw new Error("unparsed " + instance);
  const [, lat, nStr, nfStr, cStr] = m;
  const N = Number(nStr), Nf = Number(nfStr);
  const c = uOverride !== undefined ? Number(uOverride) : Number(cStr);
  const suffix = uOverride !== undefined ? `__altU_${uOverride}` : "";
  const extent = lat === "chain" ? [N] : [Math.round(Math.sqrt(N)), Math.round(Math.sqrt(N))];
  const edges = gridEdges(extent, true);
  const T = hoppingTerms(edges);
  let op, info;
  if (model === "Hubbard") {
    op = spinfulOperator(N, Nf, Nf, T, T, (su, sd) => c * popcount((su & sd) >>> 0));
    info = { sector: `N_up = N_dn = ${Nf}, no spatial symmetry`, hamiltonian: `U n_up n_dn with U=${c}, t=1`,
      script: lat === "chain" ? `scripts/${instance}/ed_netket.sh (ed.py --ham hubb --L ${N} --U ${c} --Nf ${Nf})` : `scripts/${instance}/ed_lattice_symmetries.sh (ed_ls.py --ham hubb --L 4 --U ${c} --Nf ${Nf}; lattice-symmetries sector 0 for translations, reflections, transposition)` };
  } else if (model === "tV") {
    op = spinlessOperator(N, Nf, T, (s) => { let d = 0; for (const [i, j] of edges) if (((s >>> i) & (s >>> j)) & 1) d += c; return d; });
    info = { sector: `N_f = ${Nf}, no spatial symmetry`, hamiltonian: `V n_i n_j per bond with V=${c}, t=1`, script: `scripts/${instance}/ed_netket.sh (ed.py --ham tv --L 4 --V ${c} --Nf ${Nf})` };
  } else throw new Error(model);
  console.log(`${instance}: D=${op.D} bonds=${edges.length}`);
  const r = lanczos(op.apply, op.D, { resTol: 1e-10 });
  const rec = { instance, E: r.E, E_ritz: r.E_ritz, residual: r.residual, resEst: r.resEst, iterations: r.iterations, D: op.D,
    coupling_used: c, coupling_in_instance_name: Number(cStr), alt_coupling_run: uOverride !== undefined,
    geometry: `nk.graph.Grid(extent=${JSON.stringify(extent)}, pbc=True): ${edges.length} bonds`, ...info,
    code: "out/E1-exact-recompute/run_fermions.mjs + ed_lib.mjs", seconds: (Date.now() - t0) / 1000, rss_MB: Math.round(process.memoryUsage().rss / 1e6) };
  fs.writeFileSync(new URL(instance.replace("/", "__") + suffix + ".json", RES), JSON.stringify(rec, null, 1));
  console.log(`  E=${r.E} ritz=${r.E_ritz} residual=${r.residual.toExponential(2)} it=${r.iterations} ${rec.seconds}s rss=${rec.rss_MB}MB`);
}
