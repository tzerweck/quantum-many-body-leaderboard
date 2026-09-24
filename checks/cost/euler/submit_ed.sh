#!/usr/bin/env bash
# Submit the QMBL-measured ED cost runs (checks/cost/README.md, "QMBL-measured ED cost"), one job
# per instance of ed/worklist.json with run = true. Run ON EULER from ~/agent-runs/qmbl-cost after
# `sync.sh`:
#     bash euler/submit_ed.sh [--dry] [instance-id ...]      (ids restrict the batch)
# One core per job: SciPy's sparse matrix-vector product is single-threaded, so more cores would
# be allocated and idle (the resources block would show it). Memory is the worklist's estimate
# for the stored matrix and Lanczos vectors, times 1.6, plus 3 GB.
set -euo pipefail
cd "$(dirname "$0")/.."
dry=""; [ "${1:-}" = "--dry" ] && { dry=1; shift; }
HERE="$PWD"
SCR="/cluster/scratch/$USER/agent-runs/qmbl-cost/ed"
mkdir -p "$SCR" "$HERE/ed/results" "$HERE/euler/logs"
COMMIT="$(cat "$HERE/COMMIT" 2>/dev/null || echo unknown)"
source "$HOME/agent-runs/env-jax.sh"
python - "$@" <<'PY' > "$SCR/jobs.tsv"
import json, math, sys
only = set(sys.argv[1:])
for w in json.load(open("ed/worklist.json")):
    if not w["run"] or (only and w["instance_id"] not in only):
        continue
    gb = max(4, math.ceil(1.6 * (w["memory_gb_estimate"] or 1) + 3))
    part, tlim = ("normal.4h", "04:00:00") if gb <= 16 else ("normal.24h", "24:00:00")
    slug = w["instance_id"].replace("/", "--")
    print(f"{slug}\t{w['instance_id']}\t{gb}\t{part}\t{tlim}")
PY
while IFS=$'\t' read -r slug inst gb part tlim; do
  f="$HERE/euler/ed-$slug.sbatch"
  cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-ed-$slug
#SBATCH --partition=$part
#SBATCH --time=$tlim
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=${gb}G
#SBATCH --output=$HERE/euler/logs/%x-%j.out
#SBATCH --error=$HERE/euler/logs/%x-%j.err
set -euo pipefail
source "\$HOME/agent-runs/env-jax.sh"
export QMBL_COMMIT="$COMMIT" OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 NUMBA_NUM_THREADS=1 JAX_PLATFORMS=cpu
cd "$HERE/ed"
python run_ed.py --instance "$inst" --out "$SCR/$slug.json"
cp "$SCR/$slug.json" "$HERE/ed/results/"
echo "DONE $slug \$(date -u +%FT%TZ)"
SB
  if [ -n "$dry" ]; then echo "--- $f ($gb GB, $part)"; else sbatch "$f"; fi
done < "$SCR/jobs.tsv"
