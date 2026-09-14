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

// ---------------------------------------------------------------------------------
// PDF TEXT TABLES
// ---------------------------------------------------------------------------------
// arXiv has no HTML before ~Dec 2023, so for the entire pre-2024 backlog - which is
// where the primary sources live, and where 54 of the first 97 accepted rows came from -
// pypdf's layout-mode text is the only machine-readable form. Three things make it a
// different parsing problem from the HTML path, and all three are handled here:
//
//   * There are no cell boundaries. What layout mode preserves instead is CHARACTER
//     OFFSET, so a column header is matched to a value by position on the line, not by
//     token index - headers are centred while values are right-aligned, so index
//     alignment fails on almost every real table.
//   * A dash is two different things. "-0.5603734" uses U+2212 as a minus; "---" marks a
//     missing entry. The HTML path flattens all dashes to "-", which here would turn
//     every empty cell into a number. A dash is a minus only when a digit follows it.
//   * Layout mode strips the spaces out of justified caption text, so a caption arrives
//     as "TABLEIII.Optimisedground-stateenergies(inunitsof...". The words survive intact,
//     so keyword tests are run against both the raw and the despaced form.
//
// This path is tuned for RECALL. Every hit is a worklist entry that gets read before any
// row is written (RULES.md 8), so a spurious table costs a glance and a missed one costs
// a record.

// a dash followed by a digit is a minus sign; any other dash is an empty cell
const dashes = s => s.replace(/[−–—‒‐]\s*(?=[0-9])/g, "-")
                     .replace(/[−–—‒‐]+/g, " NA ");
const normLine = s => mathDigits(s).replace(ZERO_WIDTH, "");

// test a keyword against both the line and its despaced form, because layout mode
// removes the spaces from justified text
const hits2 = (re, s) => re.test(s) || re.test(s.replace(/\s+/g, ""));

// Split a header line into cells, keeping each cell's centre column.
//
// Runs of 2+ spaces are the usual separator, but a header whose cells are themselves
// "key = value" pairs is often set with single spaces - "10x10 J2 = 0.0 J2 = 0.2 J2 = 0.4"
// collapses to ONE cell under the space rule, and then every energy in the row is
// labelled with the whole header. That is the column-misassignment this project's method
// note warns about, and on arXiv:2206.14307 it put a J2 = 0.6 energy under J2 = 0.7.
// So both splits are tried and the finer one wins.
const KEYVAL = /[A-Za-zͰ-Ͽᵀ0-ᵿf_{}\\'′\/0-9]+\s*[=:]\s*[0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+)?/gu;
function headerCells(line) {
  const bySpace = [];
  for (const m of line.matchAll(/\S(?:.*?\S)?(?=\s{2,}|$)/g)) {
    const text = m[0].trim();
    if (text) bySpace.push({ text, centre: m.index + text.length / 2 });
  }
  const byKeyVal = [];
  for (const m of line.matchAll(KEYVAL))
    byKeyVal.push({ text: m[0].trim(), centre: m.index + m[0].length / 2 });
  return byKeyVal.length > bySpace.length ? byKeyVal : bySpace;
}

// Every energy on a line, with the column it sits at. Scanned as a pattern rather than
// tokenised, because layout mode sometimes runs the last cell of one row into the first
// cell of the next ("0.0022(5)108 -0.55315(3)"), and tokenising loses both.
const LINE_ENERGY = /(?<![0-9.])-?[0-9]{1,3}\.[0-9]{4,}(?:\(\s?[0-9]{1,4}\))?/g;
function energyTokens(line) {
  const out = [];
  for (const m of line.matchAll(LINE_ENERGY))
    out.push({ t: tight(m[0]), centre: m.index + m[0].length / 2, index: m.index });
  return out;
}

const CAPTION_RE = /TABLE\s*(?:[IVXLC]+|[0-9]+)\s*[.:]/i;

function textTables(raw) {
  const lines = dashes(normLine(raw)).split("\n");
  const isData = lines.map(l => energyTokens(l).length);

  // contiguous runs of lines carrying energies, tolerating one blank line inside
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isData[i]) continue;
    let j = i;
    while (j + 1 < lines.length && (isData[j + 1] || (isData[j + 2] && !lines[j + 1].trim()))) j++;
    if (j > i || isData[i] >= 2) blocks.push([i, j]);       // a lone single-value line is prose
    i = j;
  }

  return blocks.map(([a, b], bi) => {
    // header: the nearest preceding non-blank line that carries no energy
    let header = "";
    for (let k = a - 1; k >= Math.max(0, a - 4); k--) {
      if (!lines[k].trim()) continue;
      if (isData[k]) break;
      header = lines[k]; break;
    }
    // caption: nearest "TABLE n." within 25 lines, in EITHER direction. Two-column PDFs
    // routinely put it after the body in reading order - 2211.07749 does.
    let cap = "", best = 1e9;
    for (let k = Math.max(0, a - 25); k < Math.min(lines.length, b + 25); k++) {
      if (!CAPTION_RE.test(lines[k])) continue;
      const d = k < a ? a - k : k - b;
      if (d < best) { best = d; cap = lines.slice(k, k + 4).join(" "); }
    }
    return { bi, a, b, header, caption: clean(cap).slice(0, 700).replace(/\t/g, " "),
             rows: lines.slice(a, b + 1) };
  });
}

const out = [];
let dataTables = 0, textTablesN = 0;

for (const f of fs.readdirSync("sources").filter(f => f.endsWith(".txt") && !f.startsWith("_"))) {
  const id = f.replace(".txt", "");
  const raw = fs.readFileSync(`sources/${f}`, "utf8");
  // paper-level model tags: captions in PDF text are often too terse to name the model
  const paperTags = MODEL.filter(([, re]) => hits2(re, raw)).map(([n]) => n);

  for (const tbl of textTables(raw)) {
    const cells = headerCells(tbl.header);
    const capSizes = sizeTokens(tbl.caption);
    const capTags = MODEL.filter(([, re]) => hits2(re, `${tbl.caption} ${tbl.header}`)).map(([n]) => n);
    const models = [...new Set(capTags.length ? capTags : paperTags)];
    let wrote = 0;

    for (const line of tbl.rows) {
      const ens = energyTokens(line);
      if (!ens.length) continue;
      // tokens before the first energy are the row label
      const label = line.slice(0, ens[0].index).replace(/\s+/g, " ").trim().slice(0, 70);
      // layout mode occasionally glues two table rows onto one line; flag rather than
      // guess, so triage knows the row label may belong to the other half
      const glued = cells.length && ens.length > cells.length ? 1 : 0;

      for (const e of ens) {
        const v = parseFloat(e.t.replace(/\(.*/, ""));
        const em = e.t.match(/\(([0-9]{1,4})\)$/);
        const dec = (e.t.replace(/\(.*/, "").split(".")[1] || "").length;
        const err = em ? +(+em[1] * 10 ** -dec).toPrecision(3) : null;
        // nearest header cell by character position - not by token index
        const col = cells.length
          ? cells.reduce((p, c) => Math.abs(c.centre - e.centre) < Math.abs(p.centre - e.centre) ? c : p).text
          : "";
        const sizes = [...new Set([...sizeTokens(label), ...sizeTokens(col), ...capSizes])];
        out.push({ src: "pdf", id, ti: tbl.bi, value: v, err, label, col: col.slice(0, 45),
                   sizes: sizes.slice(0, 4).join(","), models: models.join("+"),
                   caption: tbl.caption, glued });
        wrote++;
      }
    }
    if (wrote) textTablesN++;
  }
}

const files = fs.readdirSync("sources").filter(f => f.endsWith(".html"));

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
        out.push({ src: "html", id, ti, value: v, err, label: label.slice(0, 70), col: col.slice(0, 45),
          sizes: sizes.slice(0, 4).join(","), models: models.join("+"), caption, glued: 0 });
      }
    }
  }
}

// The same number reached through both paths is one candidate, not two. HTML wins: it
// has real cell boundaries, so its row label and column header are the trustworthy ones.
const seenCell = new Set();
out.sort((a, b) => (a.src === b.src ? 0 : a.src === "html" ? -1 : 1));   // html first, so it wins
const rows = out.filter(r => {
  const k = `${r.id}|${r.value}|${r.err ?? ""}`;
  return seenCell.has(k) ? false : (seenCell.add(k), true);
});

fs.writeFileSync("sweep-tables.tsv",
  "arxiv\tsrc\ttable\tvalue\terr\trow_label\tcol_header\tsizes\tmodels\tglued\tcaption\n" +
  rows.map(r => [r.id, r.src, r.ti, r.value, r.err ?? "", r.label, r.col, r.sizes, r.models, r.glued, r.caption].join("\t")).join("\n") + "\n");

const nPdf = rows.filter(r => r.src === "pdf").length;
console.error(`${files.length} HTML sources -> ${dataTables} data tables; ` +
              `${fs.readdirSync("sources").filter(f => f.endsWith(".txt") && !f.startsWith("_")).length} PDF-text sources -> ${textTablesN} blocks`);
console.error(`${out.length} energy cells, ${out.length - rows.length} duplicates dropped, ` +
              `${rows.length} kept (${rows.length - nPdf} html + ${nPdf} pdf) -> sweep-tables.tsv`);
const glued = rows.filter(r => r.glued).length;
if (glued) console.error(`${glued} cells come from lines where layout mode glued two table rows together; their row_label may belong to the other half.`);
const per = {};
rows.forEach(r => per[r.models || "(none)"] = (per[r.models || "(none)"] || 0) + 1);
console.error("cells by model tag:", Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .map(([k, v]) => `${k}:${v}`).join("  "));
