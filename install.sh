#!/usr/bin/env bash
# Bash installer for tokenmiser — the no-Node path. Prefer `npx tokenmiser install`.
#
#   ./install.sh                 symlink every skill into ~/.claude/skills
#   ./install.sh --project       into ./.claude/skills instead
#   ./install.sh --copy          copy instead of symlink
#   ./install.sh --hook          also install the tool-output filter hook
#   ./install.sh --dry-run       print the plan, write nothing
#   ./install.sh --uninstall     remove installed miser-* skills
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DST="$CLAUDE_HOME/skills"
MODE=link; DRY=0; HOOK=0; UNINSTALL=0

for a in "$@"; do
  case "$a" in
    --project|-p) DST="$PWD/.claude/skills" ;;
    --copy) MODE=copy ;;
    --link) MODE=link ;;
    --hook) HOOK=1 ;;
    --dry-run|-n) DRY=1 ;;
    --uninstall) UNINSTALL=1 ;;
    --help|-h) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a (try --help)" >&2; exit 2 ;;
  esac
done

if [ "$UNINSTALL" -eq 1 ]; then
  found=0
  for d in "$DST"/miser-*; do
    [ -e "$d" ] || continue
    found=1
    if [ "$DRY" -eq 1 ]; then echo "would remove $d"; else rm -rf "$d"; echo "removed $(basename "$d")"; fi
  done
  [ "$found" -eq 0 ] && echo "nothing to remove in $DST"
  echo "The hook and settings.json were left alone."
  exit 0
fi

echo "source: $SRC"
echo "target: $DST  (mode: $MODE)"
echo

mkdir -p "$DST"
for d in "$SRC"/skills/*/; do
  [ -f "$d/SKILL.md" ] || continue
  name=$(basename "$d")
  if [ "$DRY" -eq 1 ]; then echo "would install $name"; continue; fi
  rm -rf "${DST:?}/$name"
  if [ "$MODE" = copy ]; then cp -R "$d" "$DST/$name"; else ln -sfn "${d%/}" "$DST/$name"; fi
  echo "installed $name"
done

if [ "$HOOK" -eq 1 ] && [ "$DRY" -eq 0 ]; then
  mkdir -p "$CLAUDE_HOME/hooks"
  cp "$SRC/hooks/filter-tool-output.py" "$CLAUDE_HOME/hooks/"
  chmod +x "$CLAUDE_HOME/hooks/filter-tool-output.py"
  echo "installed hook: $CLAUDE_HOME/hooks/filter-tool-output.py"
  echo
  echo "Add this to $CLAUDE_HOME/settings.json by hand (this script does not edit your settings):"
  cat <<'JSON'
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "python3 ~/.claude/hooks/filter-tool-output.py" } ] }
    ]
  }
JSON
fi

cat <<EOF

Scripts live in this checkout. Export the root so the skills can find them:
  export MISER="$SRC"        # add to ~/.bashrc or ~/.zshrc

In Claude Code:  /miser-help  then  /miser-setup
Uninstall:       $0 --uninstall
EOF
