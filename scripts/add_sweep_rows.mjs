// Frontier rows from the 2026-09-13 sweep. Read out of Table 1 / claim sentences of the
// source HTML directly (never LLM-transcribed). S.S per site -> Pauli total = x 4 N.
import fs from "node:fs";
const CHECKED = "2026-09-13";
const CNNMPS = { ref: "arXiv:2603.14425, Disentangling Tensor Network States with Deep Neural Networks", pr: false };
const CTWF   = { ref: "Chen, Naik & Heyl, Convolutional transformer wave functions, arXiv:2503.10462", pr: false };
const HFPS   = { ref: "Chen, Wan, Sengupta & Georges, Neural network-augmented Pfaffian wave-functions for scalable simulations of interacting fermions, Proc. Natl. Acad. Sci. U.S.A. 123, e2535288123 (2026), arXiv:2507.10705", pr: true };
const HQT    = { ref: "Holographic Quantum Transformer, arXiv:2607.00398 (conference proceedings)", pr: true };
const VIT26  = { ref: "Approaching the Thermodynamic Limit with Neural-Network Quantum States, arXiv:2602.02665", pr: false };
const TBL = "Read from Table 1 of arXiv:2603.14425 (square-lattice J1-J2 at J2/J1=0.5, PBC, E per site in S.S units), parsed from the arXiv HTML.";

const ADD = {
  "J1J2/square_100_P_0.5": { rows: [
    { eps:-0.4976939, err:2e-7, m:"CNN-MPS (h,D,l)=(32,20,20), Marshall sign transformation", src:CNNMPS,
      note:TBL+' Claim: "the best energy obtained by CNN-MPS is -0.4976939(2) ... which is lower than the best previously reported result". Supersedes Chen & Heyl -0.4976921(4) as the record for this instance.' },
    { eps:-0.4976923, err:2e-7, m:"T-MPS", src:CNNMPS, note:TBL },
    { eps:-0.4976764, err:7e-7, m:"Convolutional transformer wave function (CTWF)", src:CTWF, note:TBL+" Cross-checked against the CTWF paper's own text." },
  ]},
  "J1J2/square_256_P_0.5": { rows: [
    { eps:-0.4969140, err:5e-7, m:"CNN-MPS", src:CNNMPS, note:TBL+' Claim: "For L=16, CNN-MPS yields the lowest variational energy, -0.4969140(5), compared with the previously best reported value -0.4967163(8)".' },
    { eps:-0.496786, err:1e-6, m:"T-MPS", src:CNNMPS, note:TBL },
  ]},
  "J1J2/square_400_P_0.5": { create:{ model:"J1J2", lattice:"square", n_sites:400, boundary:"P", params:{J2:0.5}, dof:400, einf:0 }, rows: [
    { eps:-0.4967987, err:6e-7, m:"CNN-MPS (h,D,l)=(32,15,20)", src:CNNMPS, note:TBL+" 20x20; no VarBench instance existed for this size." },
    { eps:-0.496732, err:1e-6, m:"ViT with symmetry restoration", src:VIT26, note:TBL+" Listed in Table 1 as the L=20 ViT 2026 value; matches the source paper's own symmetry-restoration sequence." },
  ]},
};
ADD["Hubbard/rectangular-4x16_64_P_28_8"] = { hubbard:true, rows: [
  { eps:-0.76413, err:3e-5, varPerSite:0.031283, m:"HFPS (hidden-fermion Pfaffian state)", src:HFPS,
    note: "Sec. III: \"The energy we obtain in the 16x4 lattice is E/N = -0.76413, outperforming a recent result E/N = -0.76298 produced by Transformer-NNBF\". Instance identity confirmed by that comparison value; the number is independently quoted as the HFPS result by both arXiv:2604.25775 and arXiv:2510.26906. No error bar in Sec. III; Table IV of the same paper (raw data of Fig. 7, L x 4 PBC lattices, 1/8 doping, U = 8) gives -0.76413(3) and sigma^2/N_site = 0.031283, added 2026-09-15. Published as PNAS 123, e2535288123 (2026); read from the arXiv version, the journal version not compared." },
]};
ADD["J1J2/square_100_P_0.5"].rows.push({ eps:-0.49782, err:3e-5, m:"Holographic Quantum Transformer (HQT), zero-shot 8x8->10x10 transfer", src:HQT, note:"Abstract: \"This zero-shot protocol yields an energy of E/N = -0.49782(3), statistically consistent with the variational state of the art\". It is not consistent: it is 1.3e-4 BELOW the best variational energy (CNN-MPS -0.4976939(2)) and 1.05e-4 below the zero-variance extrapolated ground state -0.497715(9), i.e. below the ground state itself, which no variational energy can be. See the defect flag." });
ADD["J1J2/square_64_P_0.5"] = { rows: [
  { eps:-0.5001, err:1e-4, varPerSite:1.4e-3, m:"Holographic Quantum Transformer (HQT)", src:HQT, note:"Abstract: \"HQT reaches a ground-state energy per site of -0.5001(1)\" on 8x8 at J2=0.5. That is 1.1e-3 below the best known variational energy for this instance (RBM+PP, -0.4989635), on a well-studied lattice. See the defect flag." },
]};
let n=0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  let inst = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,"utf8")) : { ...spec.create, instance_id:id, rows:[] };
  if (!fs.existsSync(p)) { delete inst.dof; delete inst.einf; }
  const r0 = inst.rows[0], dof = r0 ? r0.dof : spec.create.dof, einf = r0 ? r0.einf : spec.create.einf;
  const f = spec.hubbard ? inst.n_sites : 4 * inst.n_sites;
  for (const r of spec.rows) {
    const energy = +(r.eps*f).toPrecision(12);
    // per-site variance -> stored total: x N for fermions, x 16 N for spins (S.S -> Pauli)
    const varTot = r.varPerSite == null ? null : +(r.varPerSite*inst.n_sites*(spec.hubbard?1:16)).toPrecision(8);
    inst.rows.push({ energy, sigma: r.err==null?null:+(r.err*f).toPrecision(6),
      energy_variance: varTot, dof, einf,
      v_score: varTot == null ? null : (dof * varTot) / (energy - einf) ** 2, method:r.m, bound_type:"variational",
      bound_type_reason:"variational ansatz; energy is a strict upper bound (assigned during source verification)",
      reference:r.src.ref, peer_reviewed:r.src.pr, source:"sweep-2026-09-13", provenance:"primary",
      verified:{ checked_on:CHECKED, method:"arXiv HTML parsed locally, no LLM transcription",
        reported_as:`${r.eps}${r.err!=null?` (+/- ${r.err})`:``} per site${spec.hubbard?``:` in S.S units`}`, note:r.note, secondary_of:null } });
    n++;
  }
  fs.mkdirSync(`data/${id.split("/")[0]}`,{recursive:true});
  fs.writeFileSync(p, JSON.stringify(inst,null,2)+"\n");
}
console.log(`added ${n} frontier rows`);
