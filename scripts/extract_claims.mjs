// Find the FRONTIER CLAIMS in a paper, not every energy. A record claim is an energy
// sitting in a sentence that asserts it: "best variational energy", "state of the art",
// "improves on the previous best", "we reach/obtain". Everything else in these papers is
// ED benchmarking on small lattices and is not what QMBL needs.
import fs from "node:fs";
const strip = s => s.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#[0-9]+;|&[a-z]+;/g," ").replace(/\s+/g," ");
const CLAIM = /(state[- ]of[- ]the[- ]art|best (?:known |reported )?(?:variational )?energ|lowest (?:variational )?energ|previous best|improv\w+ (?:up)?on|outperform\w*|new record|surpass\w*|we (?:obtain|reach|achieve|find|report)|more accurate than)/i;
const ENERGY = /-\s?[0-9]\.[0-9]{4,}(?:\s*\(\s*[0-9]+\s*\))?/;
const SIZE = /([0-9]{1,3})\s*(?:×|x|\\times)\s*([0-9]{1,3})/;
const MODEL = /(kagome|triangular|pyrochlore|shuriken|Shastry[- ]Sutherland|Hubbard|J\s*_?1\s*[-–]\s*J\s*_?2|Heisenberg|transverse[- ]field Ising|t-V)/i;

const rows = fs.readFileSync("sweep-fulltext.tsv","utf8").split("\n").slice(1).filter(Boolean)
  .map(l => l.split("\t")).filter(c => +c[0] >= 10);
const out = [];
for (const c of rows) {
  const [sc, id, pr, , , , models, jr, ti] = c;
  const f = `sources/${id}.html`;
  if (!fs.existsSync(f)) continue;
  const s = strip(fs.readFileSync(f,"utf8"));
  const sentences = s.split(/(?<=[.;])\s+/);
  const claims = [];
  for (const [i, sen] of sentences.entries()) {
    if (!CLAIM.test(sen) || !ENERGY.test(sen)) continue;
    const ctx = (sentences[i-1]||"").slice(-130) + " " + sen;
    const en = [...sen.matchAll(new RegExp(ENERGY,"g"))].map(m=>m[0].replace(/\s/g,"")).slice(0,3);
    const sz = (ctx.match(SIZE)||[]).slice(1,3).join("x");
    const mo = (ctx.match(MODEL)||[])[1] || "";
    claims.push({ en, sz, mo, txt: sen.replace(/\s+/g," ").slice(0,230) });
  }
  if (claims.length) out.push({ sc, id, pr, jr, ti, models, claims: claims.slice(0,4) });
}
fs.writeFileSync("sweep-claims.json", JSON.stringify(out,null,1));
let n=0;
for (const p of out) {
  console.log(`\n### ${p.id} ${p.pr==="yes"?"[PEER: "+p.jr.slice(0,34)+"]":"[preprint]"}  ${p.ti.slice(0,58)}`);
  for (const c of p.claims) { n++;
    console.log(`   ${c.en.join(" ")}  |${c.mo}|${c.sz?" "+c.sz:""}  ${c.txt.slice(0,175)}`);
  }
}
console.log(`\n${n} claim sentences across ${out.length} papers (of ${rows.length} scanned) -> sweep-claims.json`);
