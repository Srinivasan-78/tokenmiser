#!/usr/bin/env bash
# Symlink tokenmiser skills into ~/.claude/skills so they load without the plugin system.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST="$HOME/.claude/skills"
mkdir -p "$DST"
for d in "$SRC"/skills/*/; do
  name=$(basename "$d")
  ln -sfn "$d" "$DST/$name"
  echo "linked $name"
done
echo
echo "MISER root: $SRC"
echo "Add to ~/.bashrc if you want the scripts on hand:  export MISER=\"$SRC\""
echo "Uninstall: rm $DST/miser-*"
