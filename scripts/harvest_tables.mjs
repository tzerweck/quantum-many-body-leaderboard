// Harvest every ENERGY CELL out of every data table in the cached sources.
//
// Why this exists: extract_claims.mjs mines claim SENTENCES ("state of the art",
// "we reach"), which only finds papers that brag in prose about one headline number.
// That is why the 2026-09-13 sweep produced four J1-J2 rows and nothing at all for
// kagome, pyrochlore or triangular: those papers report a table of sizes and never
// write the sentence. The table is where the leaderboard's missing rows actually are.
//
// Two things about ar5iv HTML make naive parsing useless. Displayed equations are also
// <table>, so a table counts as DATA only if it has several rows and several numeric
// cells. And every formula carries an <annotation> holding its LaTeX, which doubles
// every symbol ("4 x 4 4\times 4") unless it is removed before the tags are stripped.
import fs from "node:fs";

// Two invisible ar5iv habits cost this harvester most of its recall on the first pass.
// It glues numbers together with ZERO-WIDTH characters, which \s does not match, so
// "-0.560313<U+200B>(3)" fails a [0-9.()] test. And it renders the paper's OWN results -
// the bold ones, i.e. exactly the new numbers we are hunting - with MATHEMATICAL BOLD
// digits (U+1D7CE and up), which are not [0-9]. Both are normalised away up front.
const ZERO_WIDTH = /[​-‏⁠﻿­]/g;
const mathDigits = s => s.replace(/[\u{1D7CE}-\u{1D7FF}]/gu,
  c => String((c.codePointAt(0) - 0x1D7CE) % 10));

export const clean = s => mathDigits(s
  .replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, " ")   // drop the LaTeX twin
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#x?[0-9a-f]+;|&[a-z]+;/gi, " ")
  .replace(ZERO_WIDTH, "")
  .replace(/[−–—]/g, "-")
  .replace(/\s+/g, " ")).trim();

// An energy: 4+ decimals, optionally a parenthesised error bar in last-digit units.
const CELL = /^-?[0-9]{1,2}\.[0-9]{4,}(?:\(\s*[0-9]{1,4}\s*\))?$/;
const tight = s => mathDigits(s).replace(ZERO_WIDTH, "").replace(/\s+/g, "").replace(/[−–—]/g, "-");

const MODEL = [
  ["kagome", /kagome/i], ["pyrochlore", /pyrochlore/i], ["triangular", /triangular/i],
  ["shuriken", /shuriken/i], ["Shastry", /shastry[- ]sutherland/i],
  ["J1J2", /J\s*_?\{?1\}?\s*-\s*J\s*_?\{?2\}?|J\s*2\s*\/\s*J\s*1|\bJ2\b/i],
  ["Hubbard", /hubbard/i], ["TFIsing", /transverse[- ]field ising|\bTFIM\b/i],
  ["tV", /spinless fermion|\bt-V\b/i], ["Heisenberg", /heisenberg/i],
];

const sizeTokens = txt => {
  const s = new Set();
  for (const m of txt.matchAll(/\b([0-9]{1,3})\s*(?:×|x)\s*([0-9]{1,3})(?:\s*(?:×|x)\s*([0-9]{1,3}))?\b/g))
    s.add(m[3] ? `${m[1]}x${m[2]}x${m[3]}` : `${m[1]}x${m[2]}`);
  for (const m of txt.matchAll(/\bL\s*=\s*([0-9]{1,3})\b/g)) s.add(`L=${m[1]}`);
  for (const m of txt.matchAll(/\bN\s*(?:_?\{?s(?:ites)?\}?)?\s*=\s*([0-9]{2,4})\b/g)) s.add(`N=${m[1]}`);
  return [...s];
};

// Pull (caption, tableHtml) pairs. ar5iv puts both inside <figure class="ltx_table">;
// anything else is taken as a bare table with whatever caption precedes it.
function tablesOf(h) {
  const out = [];
  const seen = new Set();
  for (const fig of h.matchAll(/<figure[^>]*class="[^"]*ltx_table[^"]*"[\s\S]*?<\/figure>/gi)) {
    const cap = (fig[0].match(/<figcaption[\s\S]*?<\/figcaption>/i) || [""])[0];
    for (const t of fig[0].matchAll(/<table[\s\S]*?<\/table>/gi)) {
      out.push({ caption: clean(cap), html: t[0] });
      seen.add(t.index + fig.index);
    }
  }
  for (const t of h.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    if ([...seen].some(i => Math.abs(i - t.index) < 5)) continue;
    if (out.some(o => o.html === t[0])) continue;
    const before = h.slice(Math.max(0, t.index - 20000), t.index);
    const ci = before.toLowerCase().lastIndexOf("<figcaption");
    out.push({ caption: ci >= 0 ? clean(before.slice(ci)).slice(0, 400) : "", html: t[0] });
  }
  return out;
}

const files = fs.readdirSync("sources").filter(f => f.endsWith(".html"));
const out = [];
let dataTables = 0;

for (const f of files) {
  const id = f.replace(".html", "");
  const h = fs.readFileSync(`sources/${f}`, "utf8");

  for (const [ti, tbl] of tablesOf(h).entries()) {
    const trs = [...tbl.html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0]);
    if (trs.length < 3) continue;
    const grid = trs.map(tr => [...tr.matchAll(/<t[hd][\s\S]*?<\/t[hd]>/gi)].map(c => clean(c[0])));
    if (grid.flat().filter(c => CELL.test(tight(c))).length < 3) continue;  // equation block
    dataTables++;

    // Keep the caption long: the filling, t' and boundary conditions a row has to be
    // matched on are usually in its second half, after the headline sentence.
    const caption = tbl.caption.slice(0, 700).replace(/\t/g, " ");
    // header row = first row carrying no energy cell; its cells label the columns
    const hi = grid.findIndex(r => r.length > 1 && !r.some(c => CELL.test(tight(c))));
    const header = hi >= 0 ? grid[hi] : [];
    const capSizes = sizeTokens(caption);
    const models = MODEL.filter(([, re]) => re.test(caption)).map(([n]) => n);

    for (const [ri, row] of grid.entries()) {
      if (ri === hi) continue;
      const label = row.find(c => c && !CELL.test(tight(c))) || "";
      for (const [ci, cell] of row.entries()) {
        const tc = tight(cell);
        if (!CELL.test(tc)) continue;
        const v = parseFloat(tc.replace(/\(.*/, ""));
        const em = tc.match(/\(([0-9]{1,4})\)$/);
        const dec = (tc.replace(/\(.*/, "").split(".")[1] || "").length;
        const err = em ? +(+em[1] * 10 ** -dec).toPrecision(3) : null;
        const col = header[ci] || "";
        // size hints, most specific first: this row, this column, the caption
        const sizes = [...new Set([...sizeTokens(label), ...sizeTokens(col), ...capSizes])];
        out.push({ id, ti, value: v, err, label: label.slice(0, 70), col: col.slice(0, 45),
          sizes: sizes.slice(0, 4).join(","), models: models.join("+"), caption });
      }
    }
  }
}

fs.writeFileSync("sweep-tables.tsv",
  "arxiv\ttable\tvalue\terr\trow_label\tcol_header\tsizes\tmodels\tcaption\n" +
  out.map(r => [r.id, r.ti, r.value, r.err ?? "", r.label, r.col, r.sizes, r.models, r.caption].join("\t")).join("\n") + "\n");

console.error(`${files.length} cached sources, ${dataTables} data tables, ${out.length} energy cells -> sweep-tables.tsv`);
const per = {};
out.forEach(r => per[r.models || "(none)"] = (per[r.models || "(none)"] || 0) + 1);
console.error("cells by model tag:", Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .map(([k, v]) => `${k}:${v}`).join("  "));
