#!/usr/bin/env node
// Token accounting from Claude Code session logs.
// Usage:
//   node miser-bench.mjs report [--project <slug|.>] [--since 7d] [--top 10] [--json]
//   node miser-bench.mjs session <sessionId|latest> [--json]
//   node miser-bench.mjs compare <sessionA> <sessionB>
//   node miser-bench.mjs baseline save <label> | baseline diff <labelA> <labelB>
// Rates: optional, edit scripts/rates.json (USD per 1M tokens). Tokens always reported.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.join(os.homedir(), '.claude', 'projects');
const STATE = path.join(os.homedir(), '.claude', 'tokenmiser');
const RATES_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), 'rates.json');

const args = process.argv.slice(2);
const cmd = args[0] || 'report';
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i === -1 ? d : (args[i + 1] ?? true); };
const has = (n) => args.includes('--' + n);

function slugForCwd() { return process.cwd().replace(/\//g, '-'); }
function parseSince(s) {
  if (!s) return 0;
  const m = String(s).match(/^(\d+)([hdw])$/);
  if (!m) return 0;
  const mult = { h: 3600e3, d: 86400e3, w: 604800e3 }[m[2]];
  return Date.now() - Number(m[1]) * mult;
}
function listSessions(projectFilter) {
  if (!fs.existsSync(ROOT)) return [];
  const out = [];
  for (const proj of fs.readdirSync(ROOT)) {
    if (projectFilter && proj !== projectFilter) continue;
    const dir = path.join(ROOT, proj);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.jsonl')) out.push({ project: proj, id: f.replace(/\.jsonl$/, ''), file: path.join(dir, f) });
    }
  }
  return out;
}
function scan(file) {
  const acc = {
    turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, thinking: 0,
    toolCalls: 0, tools: {}, models: {}, first: null, last: null, userMsgs: 0,
  };
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return acc; }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const ts = o.timestamp ? Date.parse(o.timestamp) : null;
    if (ts) { acc.first = acc.first === null ? ts : Math.min(acc.first, ts); acc.last = acc.last === null ? ts : Math.max(acc.last, ts); }
    if (o.type === 'user' && typeof o.message?.content === 'string') acc.userMsgs++;
    const msg = o.message;
    const u = msg?.usage;
    if (u) {
      acc.turns++;
      acc.input += u.input_tokens || 0;
      acc.cacheRead += u.cache_read_input_tokens || 0;
      acc.cacheWrite += u.cache_creation_input_tokens || 0;
      acc.output += u.output_tokens || 0;
      acc.thinking += u.output_tokens_details?.thinking_tokens || 0;
      if (msg.model) acc.models[msg.model] = (acc.models[msg.model] || 0) + 1;
    }
    const content = msg?.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'tool_use') { acc.toolCalls++; acc.tools[c.name] = (acc.tools[c.name] || 0) + 1; }
      }
    }
  }
  return acc;
}
const effIn = (a) => a.input + a.cacheRead + a.cacheWrite;
const total = (a) => effIn(a) + a.output;
function rates() { try { return JSON.parse(fs.readFileSync(RATES_FILE, 'utf8')); } catch { return {}; } }
function cost(a) {
  const r = rates();
  const models = Object.keys(a.models);
  const key = models.sort((x, y) => a.models[y] - a.models[x])[0];
  const p = r[key] || r.default;
  if (!p || !p.input) return null;
  return (a.input * p.input + a.cacheRead * (p.cacheRead ?? p.input * 0.1) + a.cacheWrite * (p.cacheWrite ?? p.input * 1.25) + a.output * p.output) / 1e6;
}
const n = (x) => x.toLocaleString('en-US');
const k = (x) => x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : String(x);
function fmtRow(label, a) {
  const c = cost(a);
  return `${label.padEnd(38)} ${k(total(a)).padStart(8)} ${k(effIn(a)).padStart(8)} ${k(a.cacheRead).padStart(8)} ${k(a.cacheWrite).padStart(8)} ${k(a.output).padStart(7)} ${k(a.thinking).padStart(7)} ${String(a.turns).padStart(5)}${c === null ? '' : ('  $' + c.toFixed(2)).padStart(9)}`;
}
const HEAD = `${'session'.padEnd(38)} ${'total'.padStart(8)} ${'in(eff)'.padStart(8)} ${'cacheRd'.padStart(8)} ${'cacheWr'.padStart(8)} ${'out'.padStart(7)} ${'think'.padStart(7)} ${'turns'.padStart(5)}`;

function report() {
  let proj = flag('project');
  if (proj === '.') proj = slugForCwd();
  const since = parseSince(flag('since'));
  const top = Number(flag('top', 10));
  const rows = listSessions(proj).map(s => ({ ...s, acc: scan(s.file) }))
    .filter(s => s.acc.turns > 0 && (!since || (s.acc.last ?? 0) >= since))
    .sort((a, b) => total(b.acc) - total(a.acc));
  if (has('json')) { console.log(JSON.stringify(rows.map(r => ({ project: r.project, id: r.id, ...r.acc })), null, 2)); return; }
  const sum = rows.reduce((s, r) => {
    for (const kk of ['turns', 'input', 'cacheRead', 'cacheWrite', 'output', 'thinking', 'toolCalls']) s[kk] += r.acc[kk];
    s.models = s.models || {}; return s;
  }, { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, thinking: 0, toolCalls: 0, models: {} });
  console.log(HEAD);
  for (const r of rows.slice(0, top)) fmtLine(r);
  function fmtLine(r) { console.log(fmtRow(`${r.project.slice(-24)}/${r.id.slice(0, 8)}`, r.acc)); }
  console.log('-'.repeat(HEAD.length));
  console.log(fmtRow(`TOTAL (${rows.length} sessions)`, sum));
  const cacheHit = sum.cacheRead / Math.max(1, sum.cacheRead + sum.cacheWrite + sum.input);
  console.log(`\ncache read share: ${(cacheHit * 100).toFixed(1)}%  |  output/turn: ${Math.round(sum.output / Math.max(1, sum.turns))}  |  thinking share of output: ${(100 * sum.thinking / Math.max(1, sum.output)).toFixed(1)}%`);
  console.log(`eff input/turn: ${n(Math.round((sum.input + sum.cacheRead + sum.cacheWrite) / Math.max(1, sum.turns)))}  <- primary knob: context size per turn`);
}
function sessionCmd() {
  let id = args[1];
  const all = listSessions(null).map(s => ({ ...s, acc: scan(s.file) })).filter(s => s.acc.turns > 0);
  let s;
  if (!id || id === 'latest') s = all.sort((a, b) => (b.acc.last ?? 0) - (a.acc.last ?? 0))[0];
  else s = all.find(x => x.id.startsWith(id));
  if (!s) { console.error('session not found'); process.exit(1); }
  if (has('json')) { console.log(JSON.stringify({ project: s.project, id: s.id, ...s.acc }, null, 2)); return; }
  console.log(HEAD); console.log(fmtRow(`${s.project.slice(-24)}/${s.id.slice(0, 8)}`, s.acc));
  const tools = Object.entries(s.acc.tools).sort((a, b) => b[1] - a[1]);
  console.log('\ntool calls: ' + (tools.map(([t, c]) => `${t}=${c}`).join(' ') || 'none'));
  console.log('models: ' + Object.entries(s.acc.models).map(([m, c]) => `${m}=${c}`).join(' '));
  console.log(`user messages: ${s.acc.userMsgs}  |  eff input/turn: ${n(Math.round(effIn(s.acc) / Math.max(1, s.acc.turns)))}`);
}
function compare() {
  const find = (q) => { const all = listSessions(null).map(s => ({ ...s, acc: scan(s.file) })); return all.find(x => x.id.startsWith(q)); };
  const A = find(args[1]), B = find(args[2]);
  if (!A || !B) { console.error('usage: compare <sessionA> <sessionB>'); process.exit(1); }
  console.log(HEAD);
  console.log(fmtRow('A ' + A.id.slice(0, 8), A.acc));
  console.log(fmtRow('B ' + B.id.slice(0, 8), B.acc));
  const d = (f) => { const a = f(A.acc), b = f(B.acc); const p = a === 0 ? 0 : (100 * (b - a) / a); return `${k(a)} -> ${k(b)} (${p >= 0 ? '+' : ''}${p.toFixed(1)}%)`; };
  console.log(`\ntotal      ${d(total)}\neff input  ${d(effIn)}\noutput     ${d(a => a.output)}\nthinking   ${d(a => a.thinking)}\nper turn   ${d(a => Math.round(total(a) / Math.max(1, a.turns)))}`);
}
function baseline() {
  fs.mkdirSync(STATE, { recursive: true });
  const sub = args[1], label = args[2];
  const file = (l) => path.join(STATE, `baseline-${l}.json`);
  if (sub === 'save') {
    if (!label) { console.error('usage: baseline save <label>'); process.exit(1); }
    const rows = listSessions(null).map(s => ({ project: s.project, id: s.id, ...scan(s.file) })).filter(r => r.turns > 0);
    fs.writeFileSync(file(label), JSON.stringify({ at: Date.now(), rows }, null, 2));
    console.log(`saved ${rows.length} sessions to ${file(label)}`);
  } else if (sub === 'diff') {
    const A = JSON.parse(fs.readFileSync(file(args[2]), 'utf8'));
    const B = JSON.parse(fs.readFileSync(file(args[3]), 'utf8'));
    const agg = (x) => x.rows.reduce((s, r) => { for (const kk of ['turns', 'input', 'cacheRead', 'cacheWrite', 'output', 'thinking']) s[kk] += r[kk]; return s; }, { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, thinking: 0, models: {}, tools: {} });
    const a = agg(A), b = agg(B);
    console.log(HEAD); console.log(fmtRow(args[2], a)); console.log(fmtRow(args[3], b));
    const perTurn = (x) => Math.round(total(x) / Math.max(1, x.turns));
    console.log(`\nper-turn total: ${k(perTurn(a))} -> ${k(perTurn(b))} (${(100 * (perTurn(b) - perTurn(a)) / Math.max(1, perTurn(a))).toFixed(1)}%)`);
  } else console.error('usage: baseline save <label> | baseline diff <a> <b>');
}
const table = { report, session: sessionCmd, compare, baseline };
if (!table[cmd]) { console.error('unknown command: ' + cmd); process.exit(1); }
table[cmd]();
