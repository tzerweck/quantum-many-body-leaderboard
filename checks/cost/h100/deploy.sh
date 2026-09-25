#!/usr/bin/env bash
# Copy the run scripts to the H100 host and, the first time, build the environment the Euler
# runs use (NetKet 3.22.4, jax 0.8.3, flax 0.12.6, Python 3.13), then a smoke test: the
# convention check on 4 x 4 and 20 RBM steps on one free card. One ssh connection.
#     bash checks/cost/h100/deploy.sh [host]        (from the repository root; default 99problems)
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${1:-99problems}"
git rev-parse --short HEAD > /tmp/qmbl-ladder-COMMIT
tar -c run_nqs.py vit.py monitor.py h100 -C /tmp --transform 's|^qmbl-ladder-COMMIT$|COMMIT|' qmbl-ladder-COMMIT |
timeout 1200 ssh -o ConnectTimeout=25 "$HOST" 'set -euo pipefail
ROOT=/scratch/tzerweck/qmbl-cost; mkdir -p $ROOT/code $ROOT/ladder $ROOT/smoke; tar -x -C $ROOT/code
if [ ! -x $ROOT/.venv/bin/python ]; then
  uv venv -q --python 3.13 $ROOT/.venv
  VIRTUAL_ENV=$ROOT/.venv uv pip install -q "netket==3.22.4" "jax[cuda12]==0.8.3" "flax==0.12.6"
fi
source $ROOT/.venv/bin/activate
python -c "import netket, jax, flax; print(\"netket\", netket.__version__, \"jax\", jax.__version__, \"flax\", flax.__version__)"
used=$(nvidia-smi --query-compute-apps=gpu_uuid --format=csv,noheader | sort -u)
card=$(/scratch/tzerweck/gpuhist/bin/gpu-policy.sh query | sed -n "s/.* eligible=\([0-9,]*\) .*/\1/p" | cut -d, -f1)
echo "smoke card: ${card:-none}"; [ -n "$card" ] || exit 4
export JAX_ENABLE_X64=1 CUDA_VISIBLE_DEVICES=$card
cd $ROOT/code
python run_nqs.py --ed-check 2>&1 | tail -3
python run_nqs.py --instance J1J2/square_16_P_0.5 --model rbm --steps 20 --eval-samples 8192 --out $ROOT/smoke/rbm-16.json 2>&1 | tail -4'
