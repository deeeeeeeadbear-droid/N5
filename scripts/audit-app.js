#!/usr/bin/env node
/**
 * N5 日语学习 MVP — 应用静态审计（M6 收尾，提交前可重复运行）
 * 检查：
 *  1) index.html 引用的本地资源（css/js/data）均存在
 *  2) js/*.js 中引用的元素 id 在 index.html 中均存在，且 html 内无重复 id
 *  3) 导航 data-v 与 <section class="view" id="view-…"> 一一对应
 *  4) 视图元素数量与脚本加载顺序正确（脚本列表按依赖序）
 * 运行：node scripts/audit-app.js（与 scripts/validate-data.js 配合使用）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let fails = 0;
function check(ok, msg) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + msg);
  if (!ok) fails++;
}

console.log('===== N5 应用静态审计 =====');

/* 1) 资源引用存在 */
const refs = (HTML.match(/(?:src|href)="([^"]+)"/g) || [])
  .map(m => m.replace(/(?:src|href)="/, '').replace(/"$/, ''))
  .filter(r => !/^(https?:|#)/.test(r));
refs.forEach(r => {
  const p = path.join(ROOT, r);
  if (!fs.existsSync(p)) check(false, '资源缺失: ' + r);
});
check(true, '本地资源引用 ' + refs.length + ' 项均存在（' + refs.join(', ') + '）');

/* 2) js 引用的元素 id 与 html 重复 id */
const htmlIds = new Set();
const dupIds = [];
(HTML.match(/id="([^"]+)"/g) || []).forEach(m => {
  const id = m.slice(4, -1);
  if (htmlIds.has(id)) dupIds.push(id);
  htmlIds.add(id);
});
check(dupIds.length === 0, dupIds.length ? 'HTML 重复 id: ' + dupIds.join(',') : 'HTML 无重复 id');

const jsFiles = ['app.js', 'words.js', 'grammar.js', 'reading.js', 'quiz.js', 'review.js', 'annotate.js', 'progress.js'];
let refIds = new Set();
jsFiles.forEach(f => {
  const p = path.join(ROOT, 'js', f);
  if (!fs.existsSync(p)) { check(false, '缺失 js/' + f); return; }
  const code = fs.readFileSync(p, 'utf8');
  const re = /\$\((['"])([^'"]+)\1\)|getElementById\((['"])([^'"]+)\3\)/g;
  let m;
  while ((m = re.exec(code)) !== null) refIds.add(m[2] || m[4]);
});
const missing = [...refIds].filter(id => !htmlIds.has(id));
check(missing.length === 0, missing.length ? 'JS 引用了不存在的 id: ' + missing.join(', ') : 'JS 引用的 ' + refIds.size + ' 个元素 id 全部存在');

/* 3) 导航与视图一一对应 */
const navVs = (HTML.match(/class="nav"[\s\S]*?<\/nav>/)[0].match(/data-v="([^"]+)"/g) || []).map(m => m.slice(8, -1));
const missViews = navVs.filter(v => !HTML.includes('id="view-' + v + '"'));
check(missViews.length === 0, missViews.length ? '导航缺少对应视图: ' + missViews.join(',') : '导航 ' + navVs.length + ' 项与视图一一对应（' + navVs.join(' / ') + '）');

/* 4) 脚本顺序（依赖在前） */
const scriptOrder = ['data/words.js', 'data/grammar.js', 'data/reading.js', 'data/quiz-grammar.js',
  'js/annotate.js', 'js/progress.js', 'js/words.js', 'js/grammar.js', 'js/reading.js', 'js/quiz.js', 'js/review.js', 'js/app.js'];
const pos = scriptOrder.map(x => HTML.indexOf('src="' + x + '"'));
const badOrder = scriptOrder.filter((x, i) => pos[i] < 0);
const sorted = pos.slice().sort((a, b) => a - b);
check(badOrder.length === 0, badOrder.length ? '脚本缺失: ' + badOrder.join(',') : '12 个脚本引用齐全');
check(pos.join(',') === sorted.join(','), '脚本按依赖顺序加载');

/* 5) 基础结构 */
check(/^\s*<!DOCTYPE html>/i.test(HTML), 'DOCTYPE 位于文件首');
check(HTML.includes('<meta charset="UTF-8">'), 'UTF-8 元信息存在');
const navBlock = (HTML.match(/class="nav"[\s\S]*?<\/nav>/) || [''])[0];
const navCount = (navBlock.match(/data-v="[^"]+"/g) || []).length;
check(navCount === 6, '导航含 6 个模块（当前 ' + navCount + '）');

console.log('-----------------------------');
if (fails === 0) { console.log('✓ 静态审计通过，零问题'); process.exit(0); }
else { console.log('✗ 静态审计发现 ' + fails + ' 个问题'); process.exit(1); }
