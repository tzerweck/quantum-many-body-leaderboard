import fs from "node:fs";
import { instances, readTable, num } from "./parse.mjs";
import { classify } from "./bound_type.mjs";
const tally = {}, unmatched = new Map(), sample = {};
let rows = 0;
for (const it of instances()) {
  for (const r of readTable(it.file).rows) {
    rows++;
    const { bound_type } = classify(r["method"]);
    const k = bound_type || "UNCLASSIFIED";
    tally[k] = (tally[k] || 0) + 1;
    if (!sample[k]) sample[k] = r["method"];
    if (!bound_type) unmatched.set(r["method"], (unmatched.get(r["method"]) || 0) + 1);
  }
}
console.log(`rows=${rows}`);
for (const [k, c] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(c).padStart(4)}  ${(100*c/rows).toFixed(1).padStart(5)}%  ${k.padEnd(13)} e.g. ${String(sample[k]).slice(0,60)}`);
if (unmatched.size) {
  console.log(`\nUNMATCHED distinct=${unmatched.size}:`);
  console.log([...unmatched].sort((a,b)=>b[1]-a[1]).map(([k,c])=>`  ${String(c).padStart(3)}  ${k}`).join("\n"));
}
fs.writeFileSync("unmatched.txt", [...unmatched].map(([k,c])=>`${c}\t${k}`).join("\n"));
