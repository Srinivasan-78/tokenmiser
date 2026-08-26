#!/usr/bin/env python3
"""PreToolUse(Bash) hook: rewrite noisy commands so only decisive lines enter context.

Install: see skills/miser-hooks/SKILL.md. No jq dependency.
Never changes semantics of a command that already limits its own output.
"""
import json, re, sys

PIPED = ("| head", "| tail", "| grep", "|head", "|tail", "|grep", "2>&1 |", "> /dev/null")

RULES = [
    (r"^(npm test|npm run test|npx jest|yarn test|pnpm test|pytest|go test|cargo test)\b",
     "{cmd} 2>&1 | grep -E -A5 '(FAIL|FAILED|ERROR|error:|panic:|AssertionError|Traceback)' | head -120"),
    (r"^(npm run build|npx tsc|tsc|cargo build|go build|make)\b",
     "{cmd} 2>&1 | grep -E -A3 '(error|Error|ERROR|warning TS|failed)' | head -80"),
    (r"^(npm install|npm ci|pnpm install|yarn install|pip install|uv pip install)\b",
     "{cmd} 2>&1 | tail -15"),
    (r"^(docker logs|kubectl logs|journalctl)\b",
     "{cmd} 2>&1 | grep -E -i '(error|fatal|panic|exception|traceback)' | tail -60"),
    (r"^git log(?!.*--oneline)", "{cmd} --oneline | head -30"),
    (r"^git diff(?!.*(--stat|--name-only))", "{cmd} | head -400"),
    (r"^(cat|less) .*\.(log|jsonl)\b", "tail -100 {tail}"),
]

def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if not cmd or any(p in cmd for p in PIPED):
        print("{}"); return
    for pattern, template in RULES:
        if re.search(pattern, cmd.strip()):
            new = template.format(cmd=cmd.strip(), tail=cmd.split(maxsplit=1)[-1])
            print(json.dumps({"hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "updatedInput": {"command": new}}}))
            return
    print("{}")

main()
