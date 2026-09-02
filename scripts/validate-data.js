#!/usr/bin/env node
/**
 * N5 日语学习 MVP — 数据完整性校验（提交前必跑：node scripts/validate-data.js）
 * 校验规则见 spec/mvp.md §4/§6：
 *  - 词库 ≥150、语法 ≥25（助词≥8 / 动词活用≥8 / 句型≥9）、阅读 ≥3
 *  - id 唯一且格式 w0001/g0001/r0001 起递增
 *  - 必填字段非空；例句结构 { jp, cn } 完整；词条 kana 须为假名
 *  - 阅读正文（v1.4 标记语法）：
 *      · 注音：连续汉字串必须紧跟假名注音组 {よみ}（如 日本語{にほんご}、行{い}きます）
 *      · 生词：*語{よみ}* 或 *ことば*，按出现顺序与 gloss 数组一一对应（词形、整词读音一致）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
const errors = [];

function err(msg) { errorCount++; errors.push(msg); }

function loadData() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ['words', 'grammar', 'reading', 'quiz-grammar']) {
    const code = fs.readFileSync(path.join(ROOT, 'data', f + '.js'), 'utf8');
    vm.runInContext(code, sandbox, { filename: f + '.js' });
  }
  return sandbox.window.N5_DATA;
}

const KANA_RE = /^[\u3040-\u30ff\u30fc・]+$/;   // 平/片假名、长音符
const KANA_CHAR_RE = /[\u3040-\u30ff\u30fc・]/;
const KANJI_RE = /[\u4e00-\u9fff]/;

/* ---------- 通用字段检查 ---------- */
function checkRequired(obj, id, fields) {
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      err('[' + id + '] 缺少必填字段: ' + f);
    }
  }
}

function checkExamples(arr, id, annotate) {
  if (!Array.isArray(arr) || arr.length === 0) { err('[' + id + '] examples 须为至少 1 条的数组'); return; }
  arr.forEach((ex, i) => {
    if (!ex || typeof ex.jp !== 'string' || !ex.jp.trim() || typeof ex.cn !== 'string' || !ex.cn.trim()) {
      err('[' + id + '] 例句[' + i + '] 须为 { jp, cn } 且均非空');
      return;
    }
    if (annotate && ex.jp) parseRange(id, '例句[' + i + ']', ex.jp, 0, ex.jp.length, false);
  });
}

/* ---------- 阅读正文解析（v1.4：汉字后置注音） ---------- */
/**
 * 顺序解析 str[start, end)，校验：
 *  1. 每段连续汉字串后必须紧跟 {假名注音}
 *  2. { } 配对合法、内容为纯假名
 *  3. 生词标记 *…* 不可嵌套、必须成对
 * 返回 { raw: 去标记后的原文, reading: 重建读音 }（供生词比对）
 */
function parseRange(id, ctx, str, start, end, glossMode) {
  let raw = '';
  let reading = '';
  let j = start;
  while (j < end) {
    const ch = str[j];
    if (ch === '{') {
      err('[' + id + '] ' + ctx + '：注音组「{」前没有汉字（位置 ' + j + '）');
      const e = str.indexOf('}', j + 1);
      j = e < 0 || e >= end ? end : e + 1;
      continue;
    }
    if (ch === '}') {
      err('[' + id + '] ' + ctx + '：多余的「}」（位置 ' + j + '）');
      j++;
      continue;
    }
    if (KANJI_RE.test(ch)) {
      // 连续汉字串
      let k = j;
      while (k < end && KANJI_RE.test(str[k])) k++;
      const kanjiRun = str.slice(j, k);
      if (str[k] !== '{') {
        err('[' + id + '] ' + ctx + '：汉字串「' + kanjiRun + '」后缺少注音组 {…}（…' + str.slice(Math.max(0, j - 3), Math.min(end, k + 3)) + '…）');
        raw += kanjiRun;
        j = k;
        continue;
      }
      const close = str.indexOf('}', k + 1);
      if (close < 0 || close >= end) { err('[' + id + '] ' + ctx + '：汉字串「' + kanjiRun + '」的注音组缺少「}」'); j = k; continue; }
      const yomi = str.slice(k + 1, close);
      if (!yomi) err('[' + id + '] ' + ctx + '：汉字串「' + kanjiRun + '」注音为空');
      else if (!KANA_RE.test(yomi)) err('[' + id + '] ' + ctx + '：汉字串「' + kanjiRun + '」注音非假名：{' + yomi + '}');
      raw += kanjiRun;
      reading += yomi;
      j = close + 1;
      continue;
    }
    // 非汉字字符
    raw += ch;
    if (KANA_CHAR_RE.test(ch)) reading += ch;
    j++;
  }
  return { raw: raw, reading: reading };
}

function scanPassageBody(body, passage) {
  const id = passage.id;
  const gloss = passage.gloss || [];
  // 1) 通篇解析（校验汉字注音覆盖与配对）
  parseRange(id, '正文', body, 0, body.length, false);
  // 2) 提取 *…* 生词标记并逐个比对
  let idx = 0;
  let i = 0;
  const starts = [];
  while (i < body.length) {
    if (body[i] === '*') {
      const close = body.indexOf('*', i + 1);
      if (close < 0) { err('[' + id + '] 生词标记「*」缺少配对（位置 ' + i + '）'); break; }
      starts.push({ s: i + 1, e: close });
      i = close + 1;
    } else i++;
  }
  for (const seg of starts) {
    const g = gloss[idx];
    const r = parseRange(id, '生词标记(' + (idx + 1) + ')', body, seg.s, seg.e, true);
    if (!g) {
      err('[' + id + '] 生词标记第 ' + (idx + 1) + ' 个（' + r.raw + '）超出 gloss 数组长度');
    } else {
      if (r.raw !== g.word) err('[' + id + '] 生词[' + idx + '] 词形不一致：正文「' + r.raw + '」≠ gloss「' + g.word + '」');
      if (r.reading !== g.kana) err('[' + id + '] 生词[' + idx + '] 读音不一致：正文「' + r.reading + '」≠ gloss「' + g.kana + '」');
    }
    idx++;
  }
  if (starts.length !== gloss.length) {
    err('[' + id + '] 正文生词数 ' + starts.length + ' ≠ gloss 数组长度 ' + gloss.length);
  }
}

/* ---------- 主流程 ---------- */
const data = loadData();

// 词库
const words = data.words || [];
if (words.length < 800) err('词库数量不足：' + words.length + '（要求 ≥800，v2.0 M7）');
const wIds = new Set();
words.forEach(w => {
  if (!w || typeof w.id !== 'string' || !/^w\d{4}$/.test(w.id)) { err('词条 id 格式错误：' + (w && w.id)); return; }
  if (wIds.has(w.id)) err('词条 id 重复：' + w.id); wIds.add(w.id);
  checkRequired(w, w.id, ['kana', 'meaning']);
  if (!KANA_RE.test(w.kana || '')) err('[' + w.id + '] kana 须为假名：' + w.kana);
  if (typeof w.kanji === 'string' && w.kanji && !KANJI_RE.test(w.kanji)) err('[' + w.id + '] kanji 字段含非汉字内容');
  checkExamples([w.example], w.id, true);
});

// 词条查重（v2.0，spec §4.7）：kana 相同且 kanji 相同视为重复；kanji 为空则以 kana 判定
const dupKey = new Map();
words.forEach(w => {
  if (!w || typeof w.id !== 'string' || !/^w\d{4}$/.test(w.id)) return;
  const key = (w.kana || '') + '\u0000' + (w.kanji || '');
  if (dupKey.has(key)) err('词条重复（kana/kanji 相同）：' + dupKey.get(key) + ' 与 ' + w.id);
  else dupKey.set(key, w.id);
});

// 语法
const grammar = data.grammar || [];
if (grammar.length < 70) err('语法条数不足：' + grammar.length + '（要求 ≥70，v2.0 M8）');
const gIds = new Set();
const groupCount = {};
grammar.forEach(g => {
  if (!g || typeof g.id !== 'string' || !/^g\d{4}$/.test(g.id)) { err('语法 id 格式错误：' + (g && g.id)); return; }
  if (gIds.has(g.id)) err('语法 id 重复：' + g.id); gIds.add(g.id);
  checkRequired(g, g.id, ['pattern', 'group', 'meaning', 'connect']);
  if (!['助词', '动词活用', '句型'].includes(g.group)) err('[' + g.id + '] group 须为 助词/动词活用/句型：' + g.group);
  groupCount[g.group] = (groupCount[g.group] || 0) + 1;
  checkExamples(g.examples, g.id, true);
});
if ((groupCount['助词'] || 0) < 22) err('助词组不足 22 条：当前 ' + (groupCount['助词'] || 0));
if ((groupCount['动词活用'] || 0) < 16) err('动词活用组不足 16 条：当前 ' + (groupCount['动词活用'] || 0));
if ((groupCount['句型'] || 0) < 32) err('句型组不足 32 条：当前 ' + (groupCount['句型'] || 0));

// 阅读
const reading = data.reading || [];
if (reading.length < 3) err('阅读篇数不足：' + reading.length + '（要求 ≥3）');
const rIds = new Set();
reading.forEach(p => {
  if (!p || typeof p.id !== 'string' || !/^r\d{4}$/.test(p.id)) { err('阅读 id 格式错误：' + (p && p.id)); return; }
  if (rIds.has(p.id)) err('阅读 id 重复：' + p.id); rIds.add(p.id);
  checkRequired(p, p.id, ['title', 'titleCn', 'body', 'gloss', 'cn']);
  if (typeof p.body === 'string' && p.body) scanPassageBody(p.body, p);
  (p.gloss || []).forEach((g, i) => {
    if (!g) { err('[' + p.id + '] gloss[' + i + '] 为空'); return; }
    checkRequired(g, p.id + '.gloss[' + i + ']', ['word', 'kana', 'pos', 'meaning']);
    if (!KANA_RE.test(g.kana || '')) err('[' + p.id + '] gloss[' + i + '] kana 非假名：' + g.kana);
  });
});

// 语法测验题库（§4.6）
const qg = data.quizGrammar || [];
if (qg.length < 12) err('语法测验题库条数不足：' + qg.length + '（要求 ≥12，正式版全量扩充）');
const qgIds = new Set();
qg.forEach(q => {
  if (!q || typeof q.id !== 'string' || !/^gq\d{4}$/.test(q.id)) { err('语法题 id 格式错误：' + (q && q.id)); return; }
  if (qgIds.has(q.id)) err('语法题 id 重复：' + q.id); qgIds.add(q.id);
  checkRequired(q, q.id, ['question', 'hint', 'options', 'answer', 'explain']);
  if (typeof q.question === 'string') {
    const blanks = q.question.split('＿').length - 1;
    if (blanks !== 1) err('[' + q.id + '] 题干须含且仅含一个填空位 ＿（当前 ' + blanks + ' 个）');
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    err('[' + q.id + '] options 须为 4 个选项');
  } else {
    const seen = new Set();
    q.options.forEach(o => {
      if (typeof o !== 'string' || !o.trim()) err('[' + q.id + '] 选项不能为空');
      if (seen.has(o)) err('[' + q.id + '] 选项重复：' + o);
      seen.add(o);
    });
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3 || !Number.isInteger(q.answer)) {
      err('[' + q.id + '] answer 须为 0–3 的整数');
    }
  }
});

/* ---------- 输出 ---------- */
console.log('===== N5 数据完整性校验 =====');
console.log('词库   : ' + words.length + ' 词（要求 ≥800）');
console.log('语法   : ' + grammar.length + ' 条（要求 ≥70）—— 助词 ' + (groupCount['助词'] || 0) + ' / 动词活用 ' + (groupCount['动词活用'] || 0) + ' / 句型 ' + (groupCount['句型'] || 0));
console.log('阅读   : ' + reading.length + ' 篇（要求 ≥3）');
console.log('语法题 : ' + qg.length + ' 题（要求 ≥12，示例题库）');
console.log('-----------------------------');
if (errorCount === 0) {
  console.log('✓ 校验通过：全部数据字段与标记格式正确，零错误');
  process.exit(0);
} else {
  console.log('✗ 发现 ' + errorCount + ' 个错误：');
  errors.slice(0, 30).forEach(e => console.log('  - ' + e));
  if (errors.length > 30) console.log('  …（其余 ' + (errors.length - 30) + ' 个略）');
  process.exit(1);
}
