import { instances, readTable } from "./parse.mjs";
import { classify } from "./bound_type.mjs";
const byClass = {};
for (const it of instances())
  for (const r of readTable(it.file).rows) {
    const k = classify(r["method"]).bound_type || "UNCLASSIFIED";
    (byClass[k] ||= new Map()).set(r["method"], (byClass[k].get(r["method"]) || 0) + 1);
  }
const want = process.argv[2];
for (const [k, m] of Object.entries(byClass)) {
  if (want && k !== want) continue;
  console.log(`\n### ${k}  (${[...m.values()].reduce((a,b)=>a+b,0)} rows, ${m.size} distinct)`);
  console.log([...m].sort((a,b)=>b[1]-a[1]).map(([s,c])=>`  ${String(c).padStart(3)}  ${s.slice(0,95)}`).join("\n"));
}
