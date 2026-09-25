#!/usr/bin/env bash
# The NQS size ladder on one H100 of a shared group host (README, amendment v1.5): every
# ansatz of the protocol on J1-J2 at J2 = 0.5, L = 4 ... 16, one run after another on one
# card. Run on the host from a copy of checks/cost (deploy.sh puts it in $ROOT/code):
#     systemd-run --user --unit=qmbl-ladder --collect bash $ROOT/code/h100/ladder.sh
# A job whose results file exists is skipped, so the unit can be restarted at any time; a job
# that fails leaves FAILED in its directory and the ladder goes on. `touch $ROOT/STOP` ends
# the ladder after the current job.
#
# The card: the one the previous job used if it is still free, else one the host's GPU
# policy lists as eligible (idle for 20 minutes); if there is none, wait. Tristan allowed one
# card by day for this ladder beyond the day cap (2026-09-24); it never takes a second.
set -uo pipefail
ROOT=/scratch/tzerweck/qmbl-cost
CODE="$ROOT/code"
POLICY=/scratch/tzerweck/gpuhist/bin/gpu-policy.sh
source "$ROOT/.venv/bin/activate"
export JAX_ENABLE_X64=1 QMBL_COMMIT="$(cat "$CODE/COMMIT" 2>/dev/null || echo unknown)"

JOBS=()
for L in 4 6 8 10 12 14 16; do
  for model in rbm rbmsymm gcnn vit; do JOBS+=("h100-$model-j1j2-$((L * L)) J1J2/square_$((L * L))_P_0.5 $model"); done
done

free_card() {  # a card with no compute process on it
  local used; used=$(nvidia-smi --query-compute-apps=gpu_uuid --format=csv,noheader | sort -u)
  nvidia-smi --query-gpu=index,uuid --format=csv,noheader | while IFS=', ' read -r idx uuid; do
    grep -q "$uuid" <<<"$used" || echo "$idx"; done
}
pick_card() {
  local prev="${1:-}" c
  while true; do
    if [ -n "$prev" ] && free_card | grep -qx "$prev"; then echo "$prev"; return; fi
    c=$("$POLICY" query 2>/dev/null | sed -n 's/.* eligible=\([0-9,]*\) .*/\1/p' | cut -d, -f1)
    if [ -n "$c" ] && free_card | grep -qx "$c"; then echo "$c"; return; fi
    echo "$(date -Is) no eligible card, waiting" >&2; sleep 600
  done
}

GPU=""
for spec in "${JOBS[@]}"; do
  [ -e "$ROOT/STOP" ] && { echo "$(date -Is) STOP"; exit 0; }
  read -r name inst model <<<"$spec"
  OUT="$ROOT/ladder/$name"; mkdir -p "$OUT"
  [ -s "$OUT/$name.json" ] && continue
  [ -e "$OUT/FAILED" ] && continue
  GPU=$(pick_card "$GPU")
  echo "$(date -Is) START $name on GPU $GPU"
  if CUDA_VISIBLE_DEVICES=$GPU python "$CODE/run_nqs.py" --instance "$inst" --model "$model" --out "$OUT/$name.json" > "$OUT/$name.log" 2>&1 \
     && [ -s "$OUT/$name.json" ]; then
    echo "$(date -Is) DONE $name"
  else
    echo "$(date -Is) FAILED $name (exit $?), see $OUT/$name.log"; date -Is > "$OUT/FAILED"
  fi
done
echo "$(date -Is) ladder complete"
