#!/usr/bin/env bash
# What loads into EVERY session before you type anything. Ranked by estimated tokens (chars/4).
set -uo pipefail
est() { local b; b=$(wc -c < "$1" 2>/dev/null || echo 0); echo $((b / 4)); }
row() { printf '%8s  %-52s %s\n' "$2" "$1" "${3:-}"; }
TOTAL=0
add() { TOTAL=$((TOTAL + $1)); }

echo "=== always-on context (estimate, chars/4) ==="
for f in "$HOME/.claude/CLAUDE.md" "$PWD/CLAUDE.md" "$PWD/.claude/CLAUDE.md" "$PWD/AGENTS.md"; do
  [ -f "$f" ] || continue
  t=$(est "$f"); add "$t"
  lines=$(wc -l < "$f")
  warn=""; [ "$lines" -gt 200 ] && warn="OVER 200-line guidance"
  row "${f/#$HOME/~}" "$t" "${lines} lines $warn"
done

# imported memory files (@path imports inside CLAUDE.md)
for f in "$HOME/.claude/CLAUDE.md" "$PWD/CLAUDE.md"; do
  [ -f "$f" ] || continue
  grep -oE '^@[^ ]+' "$f" 2>/dev/null | sed 's/^@//' | while read -r imp; do
    p="${imp/#\~/$HOME}"; [ -f "$p" ] && row "  import: $imp" "$(est "$p")"
  done
done

# memory dir
MEM="$HOME/.claude/projects/$(echo "$PWD" | tr '/' '-')/memory"
if [ -d "$MEM" ]; then
  t=$(cat "$MEM"/MEMORY.md 2>/dev/null | wc -c); t=$((t/4)); add "$t"
  row "memory/MEMORY.md (index, always loaded)" "$t" "$(ls "$MEM" | wc -l) memory files"
fi

# settings
for f in "$HOME/.claude/settings.json" "$PWD/.claude/settings.json" "$PWD/.claude/settings.local.json"; do
  [ -f "$f" ] && { t=$(est "$f"); add "$t"; row "${f/#$HOME/~}" "$t"; }
done

echo
echo "=== skill listing tax (name+description of every installed skill) ==="
SK=0; CNT=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  c=$(awk '/^---/{n++; next} n==1' "$f" | wc -c)
  SK=$((SK + c / 4)); CNT=$((CNT + 1))
done < <(find "$HOME/.claude/skills" "$HOME/.claude/plugins/cache" "$PWD/.claude/skills" -name SKILL.md 2>/dev/null)
add "$SK"
row "$CNT skills advertised" "$SK" "~$([ "$CNT" -gt 0 ] && echo $((SK / CNT)) || echo 0) tokens each"

echo
echo "=== MCP servers (tool schemas; deferred by default but instructions still load) ==="
for f in "$HOME/.claude.json" "$PWD/.mcp.json"; do
  [ -f "$f" ] || continue
  python3 -c "import json,sys
try:
    d=json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
servers=d.get('mcpServers') or {}
for k,v in servers.items():
    print('  %-24s %s' % (k, (v.get('command') or v.get('url') or '')))
if not servers: print('  none')" "$f"
done

echo
printf '%8s  %s\n' "$TOTAL" "ESTIMATED ALWAYS-ON TOKENS (before system prompt + tools)"
echo
echo "Cross-check in-session with /context and /usage. Per-turn cost = this + conversation history + tool results."
