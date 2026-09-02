#!/usr/bin/env bash
# Ten consecutive full-suite runs (v0.9.6, Phase 12).
#
# A flaky test is a failed release candidate. This exists so the claim is a measurement rather
# than an impression: ten runs, each recorded, and a single failure is a blocker to investigate
# rather than something to re-roll until it passes.
out=".shots/stability"
mkdir -p "$out"
pass=0
for i in $(seq 1 10); do
  start=$(date +%s)
  npm test > "$out/run-$i.txt" 2>&1
  code=$?
  end=$(date +%s)
  line=$(grep -E "Tests " "$out/run-$i.txt" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | tr -s ' ')
  if [ $code -eq 0 ]; then pass=$((pass+1)); fi
  echo "run $i: exit=$code $((end-start))s $line"
done
echo "STABILITY: $pass/10 passed"
