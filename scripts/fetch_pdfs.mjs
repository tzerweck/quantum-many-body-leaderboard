// Fetch arXiv PDFs for papers whose HTML is unusable, and extract their text.
//
// Two cases need this. Papers before ~Dec 2023 have no arXiv HTML at all, which is
// most of the PRIMARY sources behind rows we could otherwise only carry as `secondary`.
// And some recent papers render as an abstract stub - the kagome Comment 2605.28861 is
// 71 KB with no bibliography and no energies.
//
// The extracted text is written to sources/<id>.txt and is COMMITTED, unlike the PDF
// itself: a number in a row has to stay checkable from a clone, and .gitignore already
// excludes sources/*.pdf.
//
// EXTRACTION MODE (added 2026-09-14). pypdf's default text extraction renders a missing
// table entry ("---") and a minus sign as the same character, so columns cannot be
// assigned - this is what blocked arXiv:2211.07749's Table III until it was re-extracted
// by hand. Layout mode preserves column positions and keeps the two apart. Both modes are
// now run in one pass and layout is kept unless it comes back substantially shorter,
// which happens on a few PDFs whose text layer defeats it. The choice is logged, and
// recorded in sources/_extraction.tsv so a row's provenance names the mode it was read in.
//
// Usage: node scripts/fetch_pdfs.mjs <arxiv-id> [<arxiv-id> ...]
//        node scripts/fetch_pdfs.mjs --from sweep-candidates.tsv [--limit N] [--reextract]
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const UA = "qmbl-sweep/1.0 (quantum-many-body-leaderboard; academic literature sweep)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// flags take a value; everything else on the command line is an arXiv id
const TAKES_VALUE = new Set(["--from", "--limit"]);
const argv = process.argv.slice(2);
const flags = {};
let ids = [];
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) { ids.push(argv[i]); continue; }
  if (TAKES_VALUE.has(argv[i])) flags[argv[i]] = argv[++i];
  else flags[argv[i]] = true;
}
const REEXTRACT = !!flags["--reextract"];
const LIMIT = +(flags["--limit"] || 0);
const from = flags["--from"] || "";

if (from) {
  const [h, ...rest] = fs.readFileSync(from, "utf8").split("\n").filter(Boolean);
  const col = h.split("\t").indexOf("arxiv");
  if (col < 0) { console.error(`${from} has no 'arxiv' column`); process.exit(1); }
  ids = rest.map(l => l.split("\t")[col]).filter(Boolean);
}
ids = [...new Set(ids)];
if (LIMIT) ids = ids.slice(0, LIMIT);
if (!ids.length) { console.error("usage: node scripts/fetch_pdfs.mjs <arxiv-id> ... | --from <tsv>"); process.exit(1); }

// Extract in both modes in a single pypdf parse, and pick. Printing a marker line lets
// the caller record which mode produced the committed text.
const PY = `
import sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
plain = "\\n".join((p.extract_text() or "") for p in r.pages)
try:
    layout = "\\n".join((p.extract_text(extraction_mode="layout") or "") for p in r.pages)
except Exception:
    layout = ""
# Layout keeps columns apart, which is the whole point, but on some PDFs it collapses.
# Keep it unless it lost more than 40% of the characters plain mode found.
use = "layout" if len(layout) >= 0.6 * len(plain) and len(layout) > 2000 else "plain"
sys.stderr.write("MODE=%s plain=%d layout=%d\\n" % (use, len(plain), len(layout)))
sys.stdout.write(layout if use == "layout" else plain)
`;

const modes = [];
let fetched = 0, cached = 0;
const failed = [];

for (const [i, id] of ids.entries()) {
  const pdf = `sources/${id}.pdf`, txt = `sources/${id}.txt`;
  if (!REEXTRACT && fs.existsSync(txt) && fs.statSync(txt).size > 2000) {
    cached++;
    if (ids.length < 30) console.error(`  ${id}: text already cached`);
    continue;
  }

  let downloaded = false;
  if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 10000) {
    for (let a = 0; a < 3 && !downloaded; a++) {
      try {
        const r = await fetch(`https://arxiv.org/pdf/${id}`, { headers: { "User-Agent": UA } });
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 10000 && buf.subarray(0, 4).toString() === "%PDF") {
            fs.writeFileSync(pdf, buf); downloaded = true;
          }
        } else if (r.status === 429) await sleep(20000);
      } catch (e) { /* retry */ }
      if (!downloaded) await sleep(6000);
    }
    if (!downloaded) { failed.push(`${id}:fetch`); console.error(`  ${id}: PDF FETCH FAILED`); await sleep(3000); continue; }
  }

  // pypdf via uv - there is no system python in this environment. spawnSync rather than
  // execFileSync because the chosen extraction mode comes back on stderr.
  const r = spawnSync("uv", ["run", "--quiet", "--with", "pypdf", "python", "-c", PY, pdf], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 500) {
    failed.push(`${id}:extract`);
    console.error(`  ${id}: EXTRACT FAILED ${String(r.stderr || r.error?.message || "empty text").slice(0, 90)}`);
  } else {
    const mode = (String(r.stderr).match(/MODE=(\w+)/) || [])[1] || "?";
    fs.writeFileSync(txt, r.stdout);
    fetched++;
    const n = new Set([...r.stdout.replace(/[−–—]/g, "-").matchAll(/-\s?[0-9]{1,2}\.[0-9]{4,}/g)].map(m => m[0])).size;
    modes.push({ id, mode, bytes: r.stdout.length });
    console.error(`  ${id}: ${Math.round(r.stdout.length / 1024)}KB ${mode}, ${n} distinct 4+-decimal energies` +
                  (downloaded ? "" : " (pdf cached)"));
  }
  if ((i + 1) % 25 === 0) console.error(`-- ${i + 1}/${ids.length} (extracted ${fetched}, cached ${cached}, failed ${failed.length})`);
  if (i < ids.length - 1 && downloaded) await sleep(3500);          // be polite to arXiv
}

if (failed.length) fs.writeFileSync("sources/_failed.txt", failed.join("\n") + "\n");
if (modes.length) {
  const prior = fs.existsSync("sources/_extraction.tsv")
    ? fs.readFileSync("sources/_extraction.tsv", "utf8").split("\n").filter(Boolean).slice(1)
        .map(l => l.split("\t")).filter(c => !modes.some(m => m.id === c[0]))
    : [];
  fs.writeFileSync("sources/_extraction.tsv", "arxiv\tmode\tbytes\n" +
    [...prior, ...modes.map(m => [m.id, m.mode, m.bytes])].sort().map(c => c.join("\t")).join("\n") + "\n");
}
const byMode = modes.reduce((a, m) => ((a[m.mode] = (a[m.mode] || 0) + 1), a), {});
console.error(`\nextracted ${fetched} (${Object.entries(byMode).map(([k, v]) => `${k}:${v}`).join(" ")}), ` +
              `already cached ${cached}, failed ${failed.length}` +
              (failed.length ? ` -> sources/_failed.txt` : ""));
