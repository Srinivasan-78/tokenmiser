# tokenmiser

Token-reduction toolkit for Claude Code. Every technique found in current research on cutting agent token usage, packaged as skills you can run one at a time and measure.

Caveman's output compression is here as `/miser-speak` (levels, persistence, auto-clarity, boundaries), its memory compression as `/miser-compress`, its delegation guidance as `/miser-delegate`, its commit/review modes as `/miser-git`, and its accounting as `/miser-bench`. The rest of the toolkit attacks the input side, which is where most of the tokens are.

## Install

```bash
./install.sh                 # symlinks skills into ~/.claude/skills
export MISER="$PWD"          # scripts reference $MISER
```
Or add this directory as a plugin marketplace entry. Uninstall: `rm ~/.claude/skills/miser-*`.

## Skills

| Skill | Lever |
|-------|-------|
| `miser-setup` | one-time config: hooks, env, CLAUDE.md diet, MCP prune, baseline |
| `miser-audit` | rank what eats context every session |
| `miser-bench` | measure tokens from session logs; A/B a change |
| `miser-speak` | terse output mode, lite/full/ultra/wenyan-* |
| `miser-compress` | shrink CLAUDE.md and memory files in place |
| `miser-session` | /clear vs /compact, handoff files, prompt-cache TTL |
| `miser-read` | search before read, ranges not whole files, repo map |
| `miser-tools` | MCP schema diet, CLI over MCP, aggregation tools |
| `miser-delegate` | when a subagent pays, and the bounded return contract |
| `miser-model` | model tiering, effort levels, thinking budget |
| `miser-prompt` | scope the request so the agent reads and writes less |
| `miser-hooks` | filter tool output before it reaches context |
| `miser-git` | terse commits and one-line reviews |
| `miser-api` | caching, batch, RAG, compaction for your own API code |

Full technique catalog with sources and reported numbers: [`reference/techniques.md`](reference/techniques.md).

## Measure first

```bash
bash scripts/context-report.sh                    # always-on tokens
node scripts/miser-bench.mjs report --since 7d    # per-turn cost, cache share, thinking share
node scripts/miser-bench.mjs baseline save pre
```

The number that matters is **eff input/turn** — total context sent per request. Output compression is real but secondary; on a typical session, input is 95%+ of tokens.

## Testing a change

One variable, fresh session each side, same prompt against the same commit:

```bash
node scripts/miser-bench.mjs session latest       # note session id for run A
# apply exactly one change
node scripts/miser-bench.mjs compare <A> <B>
```
Record wins and losses in `bench/results.md`, including whether the task still succeeded.

## Cost of the toolkit itself

Each installed skill costs ~100 tokens of name + description in every session (~1.4k for all 14). Delete the directories you never fire.
