# Token-reduction technique catalog

Every technique found in research, sorted by lever. Column `skill` = which tokenmiser skill applies it.

## 1. Input-side: what enters context every turn

| # | Technique | Mechanism | Reported effect | skill |
|---|-----------|-----------|-----------------|-------|
| 1 | Prompt caching (prefix cache) | Stable prefix reused; cache read = 0.1x input, write = 1.25x | up to 90% off repeated prefix; "single biggest cost lever in the API" | miser-api, miser-session |
| 2 | Cache TTL choice | 5-min default vs 1-hour TTL; first message after gap = full reprocess | avoids full-context cache miss | miser-session |
| 3 | CLAUDE.md diet | Loaded every session, every turn carries it | 100-line CLAUDE.md x 30 turns ~= 75k tokens; keep <200 lines | miser-audit, miser-setup |
| 4 | Move instructions to skills | Skill = ~100 token description until invoked (progressive disclosure) | 150k-token workflow -> ~2k at startup | miser-audit |
| 5 | MCP schema bloat | Tool JSON schemas can be 40-50% of window; one big server 10-17k tokens, extremes 55k+ | disable unused servers; deferred tool search | miser-tools |
| 6 | Prefer CLI over MCP | gh/aws/gcloud add zero per-tool listing cost | removes per-session tool tax | miser-tools |
| 7 | MCP schema compression / minification | Strip descriptions, enums, nested docs; dedupe via $ref | 40% per tool; mcp-compressor proxy 70-97% | miser-tools |
| 8 | Progressive tool disclosure | describe_tools first, load full schema on demand | large cut, costs extra round trip | miser-tools |
| 9 | Aggregation tools | get_sales_summary_by_region not get_all_sales_records | processing before context | miser-tools, miser-api |
| 10 | Tool-output filtering hooks | PreToolUse rewrites cmd to grep only failures | 10k-line log -> hundreds of tokens | miser-hooks, miser-setup |
| 11 | Retrieval over full reads | grep/rg + line ranges instead of whole files | grep-only retrieval still 108-117k on hard tasks; full reads worse | miser-read |
| 12 | Code intelligence / symbol nav | LSP go-to-definition replaces grep + N file reads | fewer speculative reads | miser-read, miser-setup |
| 13 | Structured index / knowledge graph | Pre-built symbol graph answers structural queries | 3.4k vs 412k tokens on 5 structural queries (vendor claim) | miser-read |
| 14 | Repo map file | docs/repo_map.md: entrypoints, key modules, files to avoid | fewer wrong-file reads | miser-read |
| 15 | RAG chunks not documents | Retrieve only needed chunks | 60-80% vs full docs | miser-api |
| 16 | Prompt compression (LLMLingua) | Small model prunes low-perplexity tokens | up to 20x on compressible prompts | miser-api |
| 17 | Session compaction | Summarize history server-side or via /compact | 132k conversation -> ~2k (API compaction example) | miser-session |
| 18 | /clear between tasks | New session, no history carried; costs nothing | full reset of per-turn history cost | miser-session |
| 19 | Handoff file | .claude/session-handoff.md keeps state across /clear | continuity without history | miser-session |
| 20 | Deduplicate context | Do not re-paste what memory/skills already hold | removes repeated blocks | miser-audit |

## 2. Output-side: what the model writes

| # | Technique | Mechanism | Reported effect | skill |
|---|-----------|-----------|-----------------|-------|
| 21 | Terse response style (caveman) | Drop articles/filler/hedging, keep technical substance | 69 -> 19 tokens on sample answer | miser-speak |
| 22 | Explicit length caps | max_tokens + "answer in <= N bullets" | 50-80% output cut on structured tasks | miser-prompt, miser-api |
| 23 | Structured output / JSON schema | Forces fields, kills prose | shorter, predictable | miser-api |
| 24 | Thinking budget control | Thinking billed as output; /effort, MAX_THINKING_TOKENS | 50-75% thinking-token cut reported | miser-model, miser-setup |
| 25 | No restated diffs / no narration | Do not echo code just written | removes duplicate payloads | miser-speak |
| 26 | Bounded subagent return contract | "return max 15 bullets, file:line only" | verbose work stays out of main context | miser-delegate |

## 3. Routing and orchestration

| # | Technique | Mechanism | Reported effect | skill |
|---|-----------|-----------|-----------------|-------|
| 27 | Model tiering | Haiku for mechanical, Sonnet default, Opus for hard reasoning | "Opus on everything" = top cost habit | miser-model |
| 28 | Subagent isolation | Verbose output stays in subagent context, summary returns | 40-70% on focused tasks | miser-delegate |
| 29 | Do not over-spawn | Subagent overhead beats savings on small tasks | wasteful under ~3-4 large files | miser-delegate |
| 30 | Agent teams cost | Each teammate = own context window; ~7x tokens in plan mode | keep teams small/short | miser-delegate |
| 31 | Plan mode first | Read-only exploration, approval before edits | avoids expensive rework | miser-session |
| 32 | Deterministic tooling first | Linters/tests/formatters answer before any inference | zero-token answers | miser-hooks |
| 33 | Batch API | Offline batching | 50% discount | miser-api |
| 34 | Semantic / response cache | Match paraphrased repeat queries | eliminates 30-70% redundant calls | miser-api |
| 35 | Scheduled task hygiene | Each /loop tick resends full context | fewer, longer intervals | miser-session |
| 36 | Cross-session messages / goal check-ins | Idle turns resend full context | crossSessionInbound=hold, GOAL_CHECKIN_MINUTES=0 | miser-setup |

## 4. Measurement

| # | Technique | Mechanism | skill |
|---|-----------|-----------|-------|
| 37 | /usage, /context, /insights | Built-in attribution: skills, subagents, plugins, MCP servers; behavior flags | miser-bench |
| 38 | Session JSONL accounting | Parse ~/.claude/projects/*/*.jsonl usage fields | miser-bench |
| 39 | A/B counterfactual | Same task, config A vs B, compare effective input tokens | miser-bench |
| 40 | OpenTelemetry export | Per-user token/cost metrics to your stack | miser-api |

## Sources
- https://code.claude.com/docs/en/costs
- https://composio.dev/content/ways-to-cut-token-consumption-in-claude-code
- https://www.mindstudio.ai/blog/reduce-token-usage-ai-agents-mcp-optimization
- https://www.mindstudio.ai/blog/token-reduction-strategies-ai-agents-cut-costs
- https://www.stackone.com/blog/mcp-token-optimization/
- https://www.atlassian.com/blog/development/mcp-compression-preventing-tool-bloat-in-ai-agents
- https://layered.dev/mcp-tool-schema-bloat-the-hidden-token-tax-and-how-to-fix-it/
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://mem0.ai/blog/the-2026-token-optimization-playbook-cut-ai-agent-memory-costs-3%E2%80%934x
- https://www.getmaxim.ai/articles/context-engineering-for-ai-agents-production-optimization-strategies/
- https://www.truefoundry.com/blog/context-engineering-gateway-session-management
- https://www.qt.io/software-insights/how-to-reduce-ai-token-usage-in-enterprise-agentic-development-workflows
- https://www.sitepoint.com/prompt-compression-cache-tuning-llm-api-costs/
- https://atlan.com/know/ai-agent/llm-cost-optimization-strategies/
- https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure
- https://arxiv.org/abs/2606.17016 (TokenPilot)
- https://arxiv.org/pdf/2605.04107 (TSCG tool-schema compilation)
- https://particula.tech/blog/semantic-code-search-vs-grep-coding-agents
