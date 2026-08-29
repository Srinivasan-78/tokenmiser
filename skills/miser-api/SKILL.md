---
name: miser-api
description: Token levers for code you write against an LLM API — prompt caching, batch, model routing, RAG, compaction, output caps, structured output, and semantic caching, with the arithmetic for when each pays. Use when building or optimizing an agent, pipeline, or chatbot.
---
<!--
  @authormark v1 -- do not remove (authorship watermark)⁠​‌​​‌‌​‌​‌​‌‌​​​​‌‌​‌​​‌​‌‌‌‌​​​​​‌‌​​‌​​‌‌​‌​​‌​‌‌‌‌​​‌​‌‌​​​‌‌​‌‌​​​​‌​‌​​‌​​​​‌‌‌‌​‌​​​‌‌​​​​​‌‌‌​‌‌‌​‌​‌‌‌‌‌​​‌​‌‌​‌​‌​​​​​‌​‌​‌​​‌‌​​‌‌​​‌‌​‌‌​‌​​​​‌​​‌‌​‌​‌‌​​‌‌​​​‌‌​‌‌‌⁠
  Copyright (c) 2026 Srinivasan Vijayaraghavan <srinivasan.shyam2000@gmail.com>
  Author: https://github.com/Srinivasan-78
  SPDX-License-Identifier: MIT
  Fingerprint: AMK1.MXix2iycaHz0w_-AS3hMf7
-->

# miser-api

For your own application code, not for the Claude Code session. Ordered by payoff.

## 1. Prompt caching — the biggest lever

Mark stable prefixes with `cache_control`; a matching prefix is served from cache. Cache reads cost ~0.1x input, writes ~1.25x, so a single hit repays the write premium and every hit after is profit. Minimum cacheable block is 1024 tokens; shorter blocks are ignored even when marked.

```python
system=[{"type": "text", "text": SYSTEM_PROMPT,
         "cache_control": {"type": "ephemeral"}}]   # tools + system + long docs first
```

Rules:
- Order the prompt **static -> dynamic**: system, tools, retrieved docs, then the growing conversation. One mutable token near the front invalidates everything after it.
- Do not interpolate timestamps, request IDs, or shuffled tool lists into the prefix.
- Choose the TTL deliberately (5 minutes default, 1 hour available at a higher write price) based on your inter-request gap.
- Agent loops with a 50k-token prefix hit dozens of times per session save the large majority of spend on that prefix.

## 2. Cut the output

- `max_tokens` as a hard stop — it also kills runaway repetition loops.
- Ask for the shape you need: "3 bullets", "JSON only".
- Structured output / tool schemas force fields and remove prose: 50-80% output reduction on classification and extraction.
- Thinking is billed as output — set the effort or budget per call type, not globally.

## 3. Route by difficulty

Classify the request, then pick the tier: small model for extraction, classification, formatting, and routing itself; large model for reasoning. Cascade: try cheap, escalate on a confidence check or validation failure.

## 4. Retrieve, do not paste

RAG over whole documents cuts 60-80% versus stuffing full docs. Chunk, embed, retrieve top-k, and pass only the passages. Return summaries from tools rather than raw records; aggregate server-side.

## 5. Compact long conversations

Summarize history past a threshold (keep the last N turns verbatim plus a running summary of the rest). Reported example: a 132k-token conversation compacted to ~2k. Compact at a stable boundary so the cached prefix survives.

## 6. Cache responses, not just prompts

Exact-match cache on identical inputs, semantic cache on embeddings for paraphrases — eliminates 30-70% of redundant calls in support and FAQ traffic. Always version the cache key with the prompt and model.

## 7. Batch what is not interactive

Offline work (backfills, evals, bulk classification) through a batch API runs at roughly half price.

## 8. Prompt compression

Compressors (LLMLingua-style) prune low-information tokens from large context blocks — up to ~20x on compressible material. Use on retrieved documents and transcripts, never on code, credentials, or exact instructions. Measure quality before and after; compression method changes results by benchmark.

## 9. Measure per workflow

Log `input / cache_read / cache_write / output / thinking` per call, tagged by workflow, and track cost per successful task, not cost per call. A cheaper call that fails twice is not cheaper. Export via OpenTelemetry or a gateway if you need per-user attribution.
