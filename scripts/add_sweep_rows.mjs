// Frontier rows from the 2026-09-13 sweep. Read out of Table 1 / claim sentences of the
// source HTML directly (never LLM-transcribed). S.S per site -> Pauli total = x 4 N.
import fs from "node:fs";
const CHECKED = "2026-09-13";
const CNNMPS = { ref: "arXiv:2603.14425, Disentangling Tensor Network States with Deep Neural Networks", pr: false };
const CTWF   = { ref: "Chen, Naik & Heyl, Convolutional transformer wave functions, arXiv:2503.10462", pr: false };
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
let n=0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  let inst = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,"utf8")) : { ...spec.create, instance_id:id, rows:[] };
  if (!fs.existsSync(p)) { delete inst.dof; delete inst.einf; }
  const r0 = inst.rows[0], dof = r0 ? r0.dof : spec.create.dof, einf = r0 ? r0.einf : spec.create.einf;
  const f = 4 * inst.n_sites;
  for (const r of spec.rows) {
    inst.rows.push({ energy:+(r.eps*f).toPrecision(12), sigma:+(r.err*f).toPrecision(6),
      energy_variance:null, dof, einf, v_score:null, method:r.m, bound_type:"variational",
      bound_type_reason:"variational ansatz; energy is a strict upper bound (assigned during source verification)",
      reference:r.src.ref, peer_reviewed:r.src.pr, source:"sweep-2026-09-13", provenance:"primary",
      verified:{ checked_on:CHECKED, method:"arXiv HTML parsed locally, no LLM transcription",
        reported_as:`${r.eps} (+/- ${r.err}) per site in S.S units`, note:r.note, secondary_of:null } });
    n++;
  }
  fs.mkdirSync(`data/${id.split("/")[0]}`,{recursive:true});
  fs.writeFileSync(p, JSON.stringify(inst,null,2)+"\n");
}
console.log(`added ${n} frontier rows`);
