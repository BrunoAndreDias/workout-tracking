#!/usr/bin/env bash
# Prints what the instance's SQLite database holds, read-only: the server's side of a persistence proof.
# Usage: stores.sh RUN_DIR [store] [--snapshots]
#   no store     one line per store: key, rev, updated_at, bytes
#   store        that store's doc, pretty-printed (exercises, workout-plans, workout-sessions, equipment)
#   --snapshots  the daily snapshots instead: day, key, bytes (or that store's snapshot docs)
# It only opens $RUN_DIR/workout.sqlite, never the user's database.
set -euo pipefail
RUN_DIR="${1:?usage: stores.sh RUN_DIR [store] [--snapshots]}"
shift
DB="$RUN_DIR/workout.sqlite"
[ -f "$DB" ] || { echo "stores: no database at $DB" >&2; exit 1; }
STORE=""
SNAPSHOTS=0
for arg in "$@"; do
  case "$arg" in
    --snapshots) SNAPSHOTS=1 ;;
    exercises | workout-plans | workout-sessions | equipment) STORE="workout-tracking:$arg" ;;
    *) echo "stores: unknown store '$arg' (exercises, workout-plans, workout-sessions, equipment)" >&2; exit 1 ;;
  esac
done
exec node --no-warnings -e '
const { DatabaseSync } = require("node:sqlite")
const [db, store, snapshots] = [new DatabaseSync(process.argv[1], { readOnly: true }), process.argv[2], process.argv[3] === "1"]
const pretty = (doc) => { try { return JSON.stringify(JSON.parse(doc), null, 2) } catch { return doc } }
if (snapshots) {
  const rows = store
    ? db.prepare("SELECT day, key, doc FROM snapshots WHERE key = ? ORDER BY day").all(store)
    : db.prepare("SELECT day, key, length(doc) AS bytes FROM snapshots ORDER BY day, key").all()
  if (rows.length === 0) console.log("stores: no snapshots")
  for (const r of rows) console.log(store ? `== ${r.day} ${r.key}\n${pretty(r.doc)}` : `${r.day}  ${r.key}  ${r.bytes} bytes`)
} else if (store) {
  const r = db.prepare("SELECT doc, rev, updated_at FROM stores WHERE key = ?").get(store)
  if (!r) { console.log(`stores: ${store} is not on the server`); process.exit(0) }
  console.log(`== ${store} rev ${r.rev} updated ${r.updated_at}\n${pretty(r.doc)}`)
} else {
  const rows = db.prepare("SELECT key, rev, updated_at, length(doc) AS bytes FROM stores ORDER BY key").all()
  if (rows.length === 0) console.log("stores: the server holds no store")
  for (const r of rows) console.log(`${r.key}  rev ${r.rev}  ${r.updated_at}  ${r.bytes} bytes`)
}
' "$DB" "$STORE" "$SNAPSHOTS"
