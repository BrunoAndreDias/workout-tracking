#!/bin/sh
# In a linked worktree with no installed dependencies, links ./node_modules to the main checkout's. Safe to rerun.
root=$(git rev-parse --show-toplevel) || exit 1
common=$(git rev-parse --path-format=absolute --git-common-dir) || exit 1
main=$(cd "$common/.." && pwd -P)
[ "$root" = "$main" ] && exit 0
[ -n "$(ls -A "$root/node_modules" 2>/dev/null)" ] && exit 0
if [ ! -d "$main/node_modules" ]; then
  echo "link-node-modules: the main checkout has no node_modules; run npm install there" >&2
  exit 1
fi
rm -rf "$root/node_modules"
ln -s "$main/node_modules" "$root/node_modules"
echo "link-node-modules: linked node_modules to $main/node_modules"
