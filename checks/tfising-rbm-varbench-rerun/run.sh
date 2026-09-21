#!/usr/bin/env bash
# Rerun of the three VarBench TFIsing RBM baselines with the VarBench program and its pinned
# dependencies (methods repo ed31bb0, programs/vmc_netket, requirements.txt: NetKet 3.13.0,
# jax 0.4.30, python 3.11: the pinned etils 1.9.2 needs >= 3.11 despite the README), CPU only, then evaluate the final parameters.
set -uo pipefail
cd "$(dirname "$0")"
export JAX_PLATFORMS=cpu CUDA_VISIBLE_DEVICES= PYTHONDONTWRITEBYTECODE=1
echo "[run] host $(hostname) start $(date -Is)"
if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null; then UV=uv; elif [ -x "$HOME/.local/bin/uv" ]; then UV="$HOME/.local/bin/uv"; else UV=""; fi
  if [ -n "$UV" ]; then
    $UV venv --python 3.11 .venv && $UV pip install --python .venv/bin/python -r vmc_netket/requirements.txt
  else
    python3 -m venv .venv && .venv/bin/pip install -q -r vmc_netket/requirements.txt
  fi
fi
echo "[run] env ready $(date -Is)"; .venv/bin/python -c "import netket, jax, sys; print('netket', netket.__version__, 'jax', jax.__version__, 'python', sys.version.split()[0]); print(jax.devices())"
cd vmc_netket
for cfg in "--boundary peri --L 10 --h 1" "--boundary open --L 10 --h 1" "--boundary peri --L 32 --h 0.5"; do
  echo "[run] === $cfg  $(date -Is)"
  ../.venv/bin/python vmc.py --ham ising --ham_dim 1 $cfg --net rbm --seed 123 2>&1 | grep -v "^\s*$" | tail -n 5
  echo "[run] --- eval  $(date -Is)"
  EVAL_REPS=5 ../.venv/bin/python eval_final.py --ham ising --ham_dim 1 $cfg --net rbm --seed 123 2>&1 | tail -n 60
done
echo "[run] done $(date -Is)"
