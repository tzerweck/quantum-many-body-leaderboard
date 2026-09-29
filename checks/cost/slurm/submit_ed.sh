#!/usr/bin/env bash
# Submit the QMBL-measured ED cost runs (checks/cost/README.md, "QMBL-measured ED cost"), one job
# per instance of ed/worklist.json with run = true. Run on the cluster from ~/agent-runs/qmbl-cost after
# `sync.sh`:
#     bash slurm/submit_ed.sh [--dry] [instance-id ...]      (ids restrict the batch)
#     MEM_GB=200 bash slurm/submit_ed.sh <ids>                 (override the memory estimate)
# Partitions and the scratch directory come from slurm/site.env.
# One core per job: SciPy's sparse matrix-vector product is single-threaded, so more cores would
# be allocated and idle (the resources block would show it). Memory is the worklist's estimate
# for the stored matrix, its construction and the Lanczos vectors, times 1.3.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f slurm/site.env ] || { echo "slurm/site.env is missing: copy slurm/site.env.example and fill it in" >&2; exit 2; }
set -a; source slurm/site.env; set +a
dry=""; [ "${1:-}" = "--dry" ] && { dry=1; shift; }
HERE="$PWD"
SCR="$SCRATCH_DIR/agent-runs/qmbl-cost/ed"
mkdir -p "$SCR" "$HERE/ed/results" "$HERE/slurm/logs"
COMMIT="$(cat "$HERE/COMMIT" 2>/dev/null || echo unknown)"
source "$HOME/agent-runs/env-jax.sh"
python - "$@" <<'PY' > "$SCR/jobs.tsv"
import json, math, os, sys
only = set(sys.argv[1:])
for w in json.load(open("ed/worklist.json")):
    if not w["run"] or (only and w["instance_id"] not in only):
        continue
    gb = int(os.environ.get("MEM_GB") or max(4, math.ceil(1.3 * (w["memory_gb_estimate"] or 1))))
    part, tlim = (os.environ["PART_CPU_4H"], "04:00:00") if gb <= 16 else (os.environ["PART_CPU_24H"], "24:00:00")
    slug = w["instance_id"].replace("/", "--")
    print(f"{slug}\t{w['instance_id']}\t{gb}\t{part}\t{tlim}")
PY
while IFS=$'\t' read -r slug inst gb part tlim; do
  f="$HERE/slurm/ed-$slug.sbatch"
  cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-ed-$slug
#SBATCH --partition=$part
#SBATCH --time=$tlim
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem-per-cpu=${gb}G
#SBATCH --output=$HERE/slurm/logs/%x-%j.out
#SBATCH --error=$HERE/slurm/logs/%x-%j.err
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
