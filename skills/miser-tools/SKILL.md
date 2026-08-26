---
name: miser-tools
description: Cut the per-session tool tax — audit MCP servers, prefer CLI over MCP, compress or defer tool schemas, and design aggregation tools that return summaries instead of raw records. Use for "MCP eating context", "too many tools", "reduce tool definitions".
---

# miser-tools

Tool schemas are charged before the user types anything. A single large MCP server costs 10-17k tokens of definitions; pathological setups exceed 55k, and schemas can occupy 40-50% of the window.

## 1. Audit

```bash
python3 -c "import json,os;d=json.load(open(os.path.expanduser('~/.claude.json')));print('\n'.join((d.get('mcpServers') or {}).keys()))"
```
In session: `/context` (what tools cost now), `/mcp` (enable/disable), `/usage` (which servers actually got used).

Decide per server: used in the last month? If no, disable. If rarely, disable and re-enable on demand.

## 2. Prefer CLI over MCP

`gh`, `aws`, `gcloud`, `stripe`, `psql`, `sentry-cli` cost **zero** per-session listing — the agent already has Bash. An MCP server for the same capability charges every session whether used or not. Keep MCP for: no CLI exists, auth is impossible from the shell, or the server returns pre-aggregated data a CLI cannot.

## 3. Shrink the schemas you keep

- **Minify**: strip descriptions to one line, drop enum documentation and examples, dedupe repeated shapes via `$ref` (~40% per tool).
- **Deferred loading**: keep tool definitions out of context until first use (Claude Code defers MCP tools by default — do not turn that off).
- **Progressive disclosure**: expose a `describe_tools` catalog tool; load a full schema only when the model commits to that tool. Costs one extra round trip, saves the whole catalog.
- **Compressing proxy**: wrap an existing server with an open-source MCP compressor (reported 70-97% description reduction, call signatures unchanged).

## 4. Design tools that return less

For servers you own:
- Aggregate server-side: `get_sales_summary_by_region(period)` not `get_all_sales_records()`.
- Default to compact output; make verbosity opt-in (`fields=[...]`, `limit`, `since`).
- Return IDs plus a summary, with a second call to fetch a specific record.
- Paginate with a hard default cap; never return an unbounded list.
- Error responses: one line and a code, not a stack trace.

## 5. Check the result

Run `/context` before and after. Expect the tools row to drop; if it does not, the server is not actually disabled.
