// For every claim sentence, decide whether it can map to a FINITE QMBL instance.
// Infinite-lattice and extrapolated numbers are the main false-record hazard
// (2510.04907 would have produced two), so they are classified out automatically.
import fs from "node:fs";
const strip = s => s.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#[0-9]+;|&[a-z]+;/g," ").replace(/\s+/g," ");
const CLAIM = /(state[- ]of[- ]the[- ]art|best (?:known |reported )?(?:variational )?energ|lowest (?:variational )?energ|previous best|improv\w+ (?:up)?on|outperform\w*|new record|surpass\w*|we (?:obtain|reach|achieve|report)|more accurate than)/i;
const ENERGY = /-\s?[0-9]\.[0-9]{4,}(?:\s*\(\s*[0-9]+\s*\))?/g;
const INF  = /\bi?PEPS\b|iPESS|infinite[- ](?:lattice|system|bond)|thermodynamic limit|\\infty|→\s*∞|per site in the limit/i;
const EXTR = /extrapolat|→\s*-?[0-9]\.|zero[- ]variance|fit(?:ted)? value/i;
const rows = fs.readFileSync("sweep-fulltext.tsv","utf8").split("\n").slice(1).filter(Boolean)
  .map(l=>l.split("\t")).filter(c=>+c[0]>=10);
const res=[];
for (const c of rows) {
  const [sc,id,pr,,,,models,jr,ti]=c;
  const f=`sources/${id}.html`; if(!fs.existsSync(f)) continue;
  const s=strip(fs.readFileSync(f,"utf8"));
  const sent=s.split(/(?<=[.;])\s+/);
  for (const [i,sen] of sent.entries()) {
    if(!CLAIM.test(sen)) continue;
    const en=[...sen.matchAll(ENERGY)].map(m=>m[0].replace(/\s/g,""));
    if(!en.length) continue;
    const ctx=(sent[i-1]||"").slice(-200)+" "+sen+" "+(sent[i+1]||"").slice(0,120);
    const sz=[...new Set([...ctx.matchAll(/([0-9]{1,3})\s*×\s*([0-9]{1,3})/g)].map(m=>m[1]+"x"+m[2]))].filter(x=>!/^0x|^1x1$/.test(x));
    const kind = INF.test(ctx) ? "INFINITE" : EXTR.test(ctx) ? "EXTRAP" : sz.length ? "FINITE" : "NO-SIZE";
    res.push({id,pr,jr,sc,kind,en:en.slice(0,2),sz:sz.slice(0,3),ti,txt:sen.slice(0,150)});
  }
}
const order={FINITE:0,"NO-SIZE":1,EXTRAP:2,INFINITE:3};
res.sort((a,b)=>order[a.kind]-order[b.kind] || (b.pr==="yes")-(a.pr==="yes"));
fs.writeFileSync("sweep-triage.json",JSON.stringify(res,null,1));
const cnt={}; res.forEach(r=>cnt[r.kind]=(cnt[r.kind]||0)+1);
console.log("counts:",JSON.stringify(cnt),"\n");
for(const r of res.filter(r=>r.kind==="FINITE"||r.kind==="NO-SIZE"))
  console.log(`${r.kind.padEnd(8)} ${r.pr==="yes"?"PEER":"prep"} ${r.id}  ${r.en.join(" ")}  [${r.sz.join(",")||"-"}]  ${r.txt.slice(0,108)}`);
