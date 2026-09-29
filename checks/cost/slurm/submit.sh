#!/usr/bin/env bash
# Submit the first batch of QMBL cost-to-reproduce runs on the cluster (README.md, protocol of
# 2026-09-21). Run on the cluster from ~/agent-runs/qmbl-cost after `sync.sh` copied this directory:
#     bash slurm/submit.sh [nqs|dmrg|all] [--dry] [job-name ...]     (names restrict the batch)
# Partitions, the request that pins the 80 GB card and the scratch directory come from slurm/site.env.
# Every job writes to $SCRATCH_DIR/agent-runs/qmbl-cost/<job-name>/ and copies its results JSON,
# trace and parameters into ~/agent-runs/qmbl-cost/results/ when done.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f slurm/site.env ] || { echo "slurm/site.env is missing: copy slurm/site.env.example and fill it in" >&2; exit 2; }
set -a; source slurm/site.env; set +a
what="${1:-all}"; shift || true
dry=""; [ "${1:-}" = "--dry" ] && { dry=1; shift; }
ONLY=("$@")
wanted() { [ ${#ONLY[@]} -eq 0 ] && return 0; for n in "${ONLY[@]}"; do [ "$n" = "$1" ] && return 0; done; return 1; }
HERE="$PWD"
SCR="$SCRATCH_DIR/agent-runs/qmbl-cost"
mkdir -p "$SCR" "$HERE/results" "$HERE/slurm/logs"
COMMIT="$(cat "$HERE/COMMIT" 2>/dev/null || echo unknown)"

# name  instance  model  partition (gpu-4h or gpu-24h, resolved in site.env)  time
NQS_JOBS=(
  "rbm-j1j2-100      J1J2/square_100_P_0.5       rbm      gpu-4h     04:00:00"
  "rbm-tri-36        Heisenberg/triangular_36_P  rbm      gpu-4h     04:00:00"
  "rbmsymm-j1j2-100  J1J2/square_100_P_0.5       rbmsymm  gpu-4h     04:00:00"
  "rbmsymm-tri-36    Heisenberg/triangular_36_P  rbmsymm  gpu-4h     04:00:00"
  "gcnn-j1j2-100     J1J2/square_100_P_0.5       gcnn     gpu-24h    24:00:00"
  "gcnn-tri-36       Heisenberg/triangular_36_P  gcnn     gpu-24h    24:00:00"
  "vit-j1j2-100      J1J2/square_100_P_0.5       vit      gpu-24h    24:00:00"
  "vit-tri-36        Heisenberg/triangular_36_P  vit      gpu-24h    24:00:00"
)
# name  instance  time  chi ladder (comma-separated)  destination (results = a row; calibration = never a row)
DMRG_JOBS=(
  "dmrg-j1j2-100     J1J2/square_100_P_0.5       100:00:00  500,1000,2000  results"
  "dmrg-tri-36       Heisenberg/triangular_36_P  60:00:00   500,1000,2000  results"
  "dmrg-cal-tri-36   Heisenberg/triangular_36_P  04:00:00   500            calibration"
  # The size ladder (README, amendment v1.5).
  "dmrg-j1j2-36      J1J2/square_36_P_0.5        24:00:00   500,1000,2000  results"
  "dmrg-j1j2-64      J1J2/square_64_P_0.5        72:00:00   500,1000,2000  results"
  # 12 x 12 at chi = 2000 ran out of memory at 8 x 8 GB after its chi = 1000 rung (job 15119534); 8 x 24 GB.
  "dmrg-j1j2-144     J1J2/square_144_P_0.5       120:00:00  500,1000,2000  results  24G"
)

submit() {  # file
  if [ -n "$dry" ]; then echo "--- $1"; cat "$1"; else sbatch "$1"; fi
}

if [ "$what" = nqs ] || [ "$what" = all ]; then
for spec in "${NQS_JOBS[@]}"; do
  read -r name inst model part tlim <<<"$spec"
  wanted "$name" || continue
  case "$part" in gpu-4h) part="$PART_GPU_4H";; gpu-24h) part="$PART_GPU_24H";; *) echo "unknown partition $part" >&2; exit 2;; esac
  f="$HERE/slurm/$name.sbatch"
  cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-$name
#SBATCH --partition=$part
#SBATCH --time=$tlim
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem-per-cpu=8G
#SBATCH --gpus=1
#SBATCH $GPU_PIN
#SBATCH --output=$HERE/slurm/logs/%x-%j.out
#SBATCH --error=$HERE/slurm/logs/%x-%j.err
set -euo pipefail
source "\$HOME/agent-runs/env-jax.sh"
export QMBL_COMMIT="$COMMIT" JAX_ENABLE_X64=1
OUT="$SCR/$name"; mkdir -p "\$OUT"
GPU=\$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader); echo "\$GPU"
# The protocol is one A100 80 GB; the type request alone once landed on a 40 GB card (smoke job 14756346).
case "\$GPU" in *A100*80GB*) ;; *) echo "wrong GPU for the protocol: \$GPU" >&2; exit 3;; esac
cd "$HERE"
python run_nqs.py --instance "$inst" --model "$model" --out "\$OUT/$name.json"
cp "\$OUT/$name.json" "\$OUT/$name.trace.jsonl" "\$OUT/$name.params.msgpack" "$HERE/results/"
echo "DONE $name \$(date -u +%FT%TZ)"
SB
  submit "$f"
done
fi

if [ "$what" = dmrg ] || [ "$what" = all ]; then
for spec in "${DMRG_JOBS[@]}"; do
  read -r name inst tlim chis dest mem <<<"$spec"
  mkdir -p "$HERE/$dest"
  wanted "$name" || continue
  f="$HERE/slurm/$name.sbatch"
  cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-$name
#SBATCH --partition=$PART_CPU_120H
#SBATCH --time=$tlim
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem-per-cpu=${mem:-8G}
#SBATCH --output=$HERE/slurm/logs/%x-%j.out
#SBATCH --error=$HERE/slurm/logs/%x-%j.err
set -euo pipefail
source "\$HOME/agent-runs/env-jax.sh"
export QMBL_COMMIT="$COMMIT" OMP_NUM_THREADS=8 MKL_NUM_THREADS=8 OPENBLAS_NUM_THREADS=8
OUT="$SCR/$name"; mkdir -p "\$OUT"
cd "$HERE"
python run_dmrg.py --instance "$inst" --chi ${chis//,/ } --out "\$OUT/$name.json" 2>&1 | grep -v "^INFO\|^DEBUG\|^=====\|^$"
cp "\$OUT/$name.json" "$HERE/$dest/"
echo "DONE $name \$(date -u +%FT%TZ)"
SB
  submit "$f"
done
fi
