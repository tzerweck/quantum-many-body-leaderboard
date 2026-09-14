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
// Usage: node scripts/fetch_pdfs.mjs <arxiv-id> [<arxiv-id> ...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const UA = "qmbl-sweep/1.0 (quantum-many-body-leaderboard; academic literature sweep)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ids = process.argv.slice(2);
if (!ids.length) { console.error("usage: node scripts/fetch_pdfs.mjs <arxiv-id> ..."); process.exit(1); }

let fetched = 0, cached = 0, failed = [];
for (const [i, id] of ids.entries()) {
  const pdf = `sources/${id}.pdf`, txt = `sources/${id}.txt`;
  if (fs.existsSync(txt) && fs.statSync(txt).size > 2000) { cached++; console.error(`  ${id}: text already cached`); continue; }

  if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 10000) {
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const r = await fetch(`https://arxiv.org/pdf/${id}`, { headers: { "User-Agent": UA } });
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 10000 && buf.subarray(0, 4).toString() === "%PDF") {
            fs.writeFileSync(pdf, buf); ok = true;
          }
        } else if (r.status === 429) await sleep(20000);
      } catch (e) { /* retry */ }
      if (!ok) await sleep(6000);
    }
    if (!ok) { failed.push(id); console.error(`  ${id}: PDF FETCH FAILED`); await sleep(3000); continue; }
  }

  // pypdf via uv - there is no system python in this environment
  try {
    const out = execFileSync("uv", ["run", "--quiet", "--with", "pypdf", "python", "-c", `
import sys
from pypdf import PdfReader
r = PdfReader(sys.argv[1])
sys.stdout.write("\\n".join((p.extract_text() or "") for p in r.pages))
`, pdf], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(txt, out);
    fetched++;
    const n = new Set([...out.replace(/[−–—]/g, "-").matchAll(/-\s?[0-9]{1,2}\.[0-9]{4,}/g)].map(m => m[0])).size;
    console.error(`  ${id}: ${Math.round(out.length / 1024)}KB text, ${n} distinct 4+-decimal energies`);
  } catch (e) {
    failed.push(id); console.error(`  ${id}: EXTRACT FAILED ${String(e.message).slice(0, 90)}`);
  }
  if (i < ids.length - 1) await sleep(3500);          // be polite to arXiv
}
console.error(`\nextracted ${fetched}, already cached ${cached}, failed ${failed.length}${failed.length ? ": " + failed.join(" ") : ""}`);
