---
name: miser-hooks
description: Preprocess tool output with hooks so raw logs, test runs, and builds never reach the context — plus deterministic checks that answer without any model call. Use for "filter test output", "logs blowing up context", "hook to save tokens".
---

# miser-hooks

A hook runs outside the model. Anything it filters is never paid for. Reported: a 10,000-line log reduced from tens of thousands of tokens to hundreds.

## Install the filter

```bash
mkdir -p ~/.claude/hooks
cp "$MISER/hooks/filter-tool-output.py" ~/.claude/hooks/
chmod +x ~/.claude/hooks/filter-tool-output.py
```

`~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "python3 ~/.claude/hooks/filter-tool-output.py" } ] }
    ]
  }
}
```

Verify: `/hooks` lists it under PreToolUse; `claude --debug` shows `modified tool input keys: [command]` on a rewritten command. Test offline:

```bash
echo '{"tool_input":{"command":"npm test"}}' | python3 ~/.claude/hooks/filter-tool-output.py
```

## What it rewrites

Test runners keep only failures with 5 lines of context; builds keep errors; installs keep the tail; container and journal logs keep error lines; `git log` gets `--oneline | head -30`; `git diff` is capped. Commands that already pipe to `head`/`tail`/`grep` are left untouched.

## Extend it

Add a `(regex, template)` pair to `RULES` in the script. Rules for your repo:
- Custom test runner: keep the failure summary block only.
- Chatty linter: `| grep -v '^info'`.
- Data files: `head -5` plus `wc -l` instead of the file.

Keep every rewrite semantically identical to what the agent asked for — filtering output is fine, changing which command runs is not.

## Deterministic checks before inference

The cheapest token is the one no model spends. Run linters, type checks, formatters, and schema validators in a PostToolUse hook or a pre-commit hook. They answer mechanical questions for free and stop the agent from reading files to find what a compiler already knows.

## Other hook levers

- **PostToolUse** on `Edit`: run the formatter and the type checker, feed back only errors.
- **SessionStart**: inject a 10-line project brief instead of a 200-line CLAUDE.md.
- **Stop**: append a handoff file so the next session starts small (`/miser-session`).

Hooks execute shell commands with your permissions. Read any hook before installing it.
