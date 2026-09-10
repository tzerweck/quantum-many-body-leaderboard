import fs from "node:fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#[0-9]+;/g, "")
  .replace(/&[a-z]+;/g, "").replace(/\s+/g, " ").trim();
const needle = (process.argv[3] || "").toLowerCase();
const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
tables.forEach((t, i) => {
  const txt = strip(t).toLowerCase();
  if (needle && !txt.includes(needle)) return;
  const idx = html.indexOf(t);
  const cap = strip((html.slice(Math.max(0, idx - 2500), idx + t.length + 2500).match(/<figcaption[\s\S]*?<\/figcaption>/i) || [""])[0]);
  console.log(`\n===== TABLE ${i} =====\nCAPTION: ${cap.slice(0, 400)}`);
  for (const row of t.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cells = (row.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) || []).map(strip);
    if (cells.some((c) => c)) console.log("  " + cells.map((c) => c.padEnd(14)).join("| "));
  }
});
