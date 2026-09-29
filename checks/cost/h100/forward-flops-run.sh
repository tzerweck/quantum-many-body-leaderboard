#!/usr/bin/env bash
# Runs on the H100 host as a user unit, started by forward-flops.sh: the count on the CPU, then
# XLA's counts on one eligible card (GPU policy: idle 20 minutes, or our own hand-over card).
set -uo pipefail
R=/scratch/tzerweck/qmbl-cost/flops
cd "$R"
source /scratch/tzerweck/qmbl-cost/.venv/bin/activate  # NetKet 3.22.4, jax 0.8.3, flax 0.12.6 (deploy.sh)
export JAX_ENABLE_X64=1 XLA_PYTHON_CLIENT_PREALLOCATE=false PYTHONUNBUFFERED=1
: > status
CUDA_VISIBLE_DEVICES= JAX_PLATFORMS=cpu python forward_flops.py --out cpu.json > cpu.log 2>&1
echo "cpu exit $?" >> status
card=$(/scratch/tzerweck/gpuhist/bin/gpu-policy.sh pick 2>/dev/null | awk 'NR == 1 {print $1}')
if [ -s cpu.json ] && [[ "$card" =~ ^[0-9]+$ ]]; then
  CUDA_VISIBLE_DEVICES=$card JAX_PLATFORMS=cuda python forward_flops.py --gpu-into cpu.json --out forward-flops.json > gpu.log 2>&1
  echo "gpu card $card exit $?" >> status
  [ -s forward-flops.json ] || cp cpu.json forward-flops.json
else
  echo "gpu: no eligible card (${card:-none})" >> status
  [ -s cpu.json ] && cp cpu.json forward-flops.json
fi
echo DONE >> status
