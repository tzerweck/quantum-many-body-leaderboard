#!/usr/bin/env bash
# Submit the first batch of QMBL cost-to-reproduce runs on Euler (README.md, protocol of
# 2026-09-21). Run ON EULER from ~/agent-runs/qmbl-cost after `sync.sh` copied this directory:
#     bash euler/submit.sh [nqs|dmrg|all] [--dry] [job-name ...]     (names restrict the batch)
# Every job writes to $SCRATCH/agent-runs/qmbl-cost/<job-name>/ and copies its results JSON,
# trace and parameters into ~/agent-runs/qmbl-cost/results/ when done.
set -euo pipefail
cd "$(dirname "$0")/.."
what="${1:-all}"; shift || true
dry=""; [ "${1:-}" = "--dry" ] && { dry=1; shift; }
ONLY=("$@")
wanted() { [ ${#ONLY[@]} -eq 0 ] && return 0; for n in "${ONLY[@]}"; do [ "$n" = "$1" ] && return 0; done; return 1; }
HERE="$PWD"
SCR="/cluster/scratch/$USER/agent-runs/qmbl-cost"
mkdir -p "$SCR" "$HERE/results" "$HERE/euler/logs"
COMMIT="$(cat "$HERE/COMMIT" 2>/dev/null || echo unknown)"

# name  instance  model  partition  time
NQS_JOBS=(
  "rbm-j1j2-100      J1J2/square_100_P_0.5       rbm      gpupr.4h   04:00:00"
  "rbm-tri-36        Heisenberg/triangular_36_P  rbm      gpupr.4h   04:00:00"
  "rbmsymm-j1j2-100  J1J2/square_100_P_0.5       rbmsymm  gpupr.4h   04:00:00"
  "rbmsymm-tri-36    Heisenberg/triangular_36_P  rbmsymm  gpupr.4h   04:00:00"
  "gcnn-j1j2-100     J1J2/square_100_P_0.5       gcnn     gpupr.24h  24:00:00"
  "gcnn-tri-36       Heisenberg/triangular_36_P  gcnn     gpupr.24h  24:00:00"
  "vit-j1j2-100      J1J2/square_100_P_0.5       vit      gpupr.24h  24:00:00"
  "vit-tri-36        Heisenberg/triangular_36_P  vit      gpupr.24h  24:00:00"
)
# name  instance  time  chi ladder (comma-separated)  destination (results = a row; calibration = never a row)
DMRG_JOBS=(
  "dmrg-j1j2-100     J1J2/square_100_P_0.5       100:00:00  500,1000,2000  results"
  "dmrg-tri-36       Heisenberg/triangular_36_P  60:00:00   500,1000,2000  results"
  "dmrg-cal-tri-36   Heisenberg/triangular_36_P  04:00:00   500            calibration"
)

submit() {  # file
  if [ -n "$dry" ]; then echo "--- $1"; cat "$1"; else sbatch "$1"; fi
}

if [ "$what" = nqs ] || [ "$what" = all ]; then
for spec in "${NQS_JOBS[@]}"; do
  read -r name inst model part tlim <<<"$spec"
  wanted "$name" || continue
  f="$HERE/euler/$name.sbatch"
  cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-$name
#SBATCH --partition=$part
#SBATCH --time=$tlim
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem-per-cpu=8G
#SBATCH --gpus=1
#SBATCH --gres=gpumem:80g
#SBATCH --output=$HERE/euler/logs/%x-%j.out
#SBATCH --error=$HERE/euler/logs/%x-%j.err
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
  read -r name inst tlim chis dest <<<"$spec"
  mkdir -p "$HERE/$dest"
  wanted "$name" || continue
  f="$HERE/euler/$name.sbatch"
  cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-$name
#SBATCH --partition=normal.120h
#SBATCH --time=$tlim
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem-per-cpu=8G
#SBATCH --output=$HERE/euler/logs/%x-%j.out
#SBATCH --error=$HERE/euler/logs/%x-%j.err
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
