#!/usr/bin/env bash
# XLA's count of every cost-run network compiled for the runs' own GPU, an A100 80 GB:
# the GPU cross-check of forward-flops.json (README, "The forward pass, counted"). Runs on the cluster
# from ~/agent-runs/qmbl-cost, where forward_flops.py, run_nqs.py, vit.py, monitor.py and the CPU
# pass's forward-flops.json have been copied (one ssh from the laptop):
#     tar czf - forward_flops.py run_nqs.py vit.py monitor.py forward-flops.json slurm/submit_flops.sh slurm/site.env |
#       ssh <cluster> 'cd ~/agent-runs/qmbl-cost && tar xzf - && bash slurm/submit_flops.sh'
# The job writes ~/agent-runs/qmbl-cost/flops/forward-flops-gpu.json: the CPU pass's file with
# `xla.lowered_gpu` and `xla.compiled_gpu` added per network. Nothing runs on the card but XLA's
# compiler (its autotuning), so a short job on the 4-hour partition is enough.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f slurm/site.env ] || { echo "slurm/site.env is missing: copy slurm/site.env.example and fill it in" >&2; exit 2; }
set -a; source slurm/site.env; set +a
HERE="$PWD"
mkdir -p "$HERE/flops" "$HERE/slurm/logs"
cp forward-flops.json "$HERE/flops/forward-flops-cpu.json"
f="$HERE/slurm/flops-gpu.sbatch"
cat > "$f" <<SB
#!/bin/bash
#SBATCH --job-name=qmbl-cost-flops-gpu
#SBATCH --partition=$PART_GPU_4H
#SBATCH --time=01:00:00
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem-per-cpu=8G
#SBATCH --gpus=1
#SBATCH $GPU_PIN
#SBATCH --output=$HERE/slurm/logs/%x-%j.out
#SBATCH --error=$HERE/slurm/logs/%x-%j.err
set -euo pipefail
source "\$HOME/agent-runs/env-jax.sh"
export JAX_ENABLE_X64=1 JAX_PLATFORMS=cuda XLA_PYTHON_CLIENT_PREALLOCATE=false PYTHONUNBUFFERED=1
GPU=\$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader); echo "\$GPU"
# The runs' device is an A100 80 GB; the type request alone once landed on a 40 GB card.
case "\$GPU" in *A100*80GB*) ;; *) echo "wrong GPU for the cross-check: \$GPU" >&2; exit 3;; esac
cd "$HERE"
python forward_flops.py --gpu-into flops/forward-flops-cpu.json --out flops/forward-flops-gpu.json
echo "DONE flops-gpu \$(date -u +%FT%TZ)"
SB
sbatch "$f"
