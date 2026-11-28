#!/usr/bin/env bash
# Runs e2e/*.mjs regressions against the instance launch.sh started, never against port 5180.
# Usage: e2e.sh RUN_DIR [name ...]   (names without .mjs; none runs them all)
# Each script gets SHOTS=$RUN_DIR/e2e/<name> and writes its output to $RUN_DIR/e2e/<name>.log.
# Every script empties the instance's database first. dictation downloads the real Whisper model.
set -uo pipefail
RUN_DIR="${1:?usage: e2e.sh RUN_DIR [name ...]}"
shift
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
"$(dirname "$0")/doctor.sh" "$RUN_DIR" || exit 1
PORT="$(cat "$RUN_DIR/server.port")"
APP_URL="http://127.0.0.1:$PORT/"
cd "$ROOT"
if [ $# -eq 0 ]; then
  set -- $(ls e2e/*.mjs | sed -e 's#^e2e/##' -e 's#\.mjs$##' | grep -v '^_')
fi
failed=()
for name in "$@"; do
  [ -f "e2e/$name.mjs" ] || { echo "e2e: no script e2e/$name.mjs" >&2; failed+=("$name"); continue; }
  mkdir -p "$RUN_DIR/e2e/$name"
  if APP_URL="$APP_URL" SHOTS="$RUN_DIR/e2e/$name" WORKOUT_DB="$RUN_DIR/workout.sqlite" \
    node "e2e/$name.mjs" >"$RUN_DIR/e2e/$name.log" 2>&1; then
    echo "e2e: ok   $name"
  else
    echo "e2e: FAIL $name (see $RUN_DIR/e2e/$name.log)"
    failed+=("$name")
  fi
done
if [ ${#failed[@]} -gt 0 ]; then
  echo "e2e: failed ${failed[*]}"
  exit 1
fi
echo "e2e: passed $# scripts"
