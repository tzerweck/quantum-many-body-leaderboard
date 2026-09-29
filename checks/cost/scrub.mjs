// Results name the hardware, never the cluster, the node or the account (Tristan, 2026-09-29).
// This removes the keys `host` and `slurm_partition` wherever they occur, reduces absolute paths
// in a recorded command line (`argv`) to file names, and rewrites any other path into a run
// directory as ~/agent-runs/...; in the committed job logs likewise. It is idempotent, and
// `slurm/sync.sh --fetch` runs it on everything it fetches.
//
// `leaksIn(text)` is the validator's check on what the site publishes (QMBL's own rows, the ED
// cost field): the same keys and paths, plus the machines' own names, which it reads from the
// gitignored checks/cost/*/site.env (slurm/site.env.example) so that they are written nowhere public.
//     node checks/cost/scrub.mjs          (from the repository root)
import fs from "node:fs";
import path from "node:path";

const ROOT = "checks/cost";
const DROP = new Set(["host", "slurm_partition"]);
// An absolute path up to a run directory: /any/prefix/agent-runs/ -> ~/agent-runs/
const RUN_PATH = /(?<![\w~.])\/(?:[^/\s"'()]+\/)+?agent-runs\//g;
const LOG_DIR = /qmbl-cost\/[a-z]+\/logs\//g; // the scripts' log directory, whatever it was called

// The machines' own names, from slurm/site.env and any other checks/cost/*/site.env (gitignored).
export function siteTokens() {
  const envs = fs.existsSync(ROOT) ? fs.readdirSync(ROOT).map(d => path.join(ROOT, d, "site.env")).filter(p => fs.existsSync(p)) : [];
  const out = [];
  for (const line of envs.flatMap(p => fs.readFileSync(p, "utf8").split("\n"))) {
    const m = line.match(/^\s*([A-Z_0-9]+)=["']?([^"'#\n]*?)["']?\s*(?:#.*)?$/);
    if (!m || !m[2] || m[2].startsWith("<")) continue;
    if (m[1] === "SCRATCH_DIR") out.push(m[2]); // its last part is the account, also the public GitHub user
    else if (m[1] === "GPU_PIN") out.push(...m[2].split(/[\s=:]+/).filter(t => t.length > 3 && !t.startsWith("-")));
    else out.push(m[2]);
  }
  return [...new Set(out.filter(t => t.length > 2))];
}

export function leaksIn(text) {
  const found = [];
  if (/"(host|slurm_partition)"\s*:/.test(text)) found.push("a node or partition field");
  if (new RegExp(RUN_PATH.source).test(text)) found.push("a path on the cluster");
  for (const t of siteTokens()) if (text.toLowerCase().includes(t.toLowerCase())) found.push(`"${t}"`);
  return found;
}

function clean(v, key) {
  if (Array.isArray(v)) return key === "argv"
    ? v.map(a => (typeof a === "string" && a.startsWith("/") ? path.basename(a) : a))
    : v.map(x => clean(x));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!DROP.has(k)) o[k] = clean(x, k);
    return o;
  }
  return typeof v === "string" ? v.replace(RUN_PATH, "~/agent-runs/") : v;
}

const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "__pycache__") walk(p); }
  else if (/\.(json|jsonl|out)$/.test(e.name)) files.push(p);
} };

if (process.argv[1] && process.argv[1].endsWith("scrub.mjs")) {
  walk(ROOT);
  let changed = 0;
  for (const p of files) {
    const before = fs.readFileSync(p, "utf8");
    let after;
    if (p.endsWith(".out")) after = before.replace(RUN_PATH, "~/agent-runs/").replace(LOG_DIR, "qmbl-cost/slurm/logs/");
    else if (p.endsWith(".jsonl")) after = before.split("\n").map(l => (/"(host|slurm_partition)"\s*:|agent-runs\/|"argv"/.test(l) ? JSON.stringify(clean(JSON.parse(l))) : l)).join("\n");
    else {
      if (!/"(host|slurm_partition)"\s*:|agent-runs\/|"argv"/.test(before)) continue;
      after = JSON.stringify(clean(JSON.parse(before)), null, 1) + (before.endsWith("\n") ? "\n" : "");
    }
    if (after !== before) { fs.writeFileSync(p, after); changed++; }
  }
  const left = files.flatMap(p => leaksIn(fs.readFileSync(p, "utf8")).map(l => `${p}: ${l}`));
  console.log(`scrub: ${changed} of ${files.length} files changed${left.length ? `; still naming the cluster:\n  ${left.join("\n  ")}` : ""}`);
}
