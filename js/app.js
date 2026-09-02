/* ==========================================================
 * N5 日语学习 MVP — 应用入口脚本（M1：模块路由骨架）
 * 里程碑 M1：数据层就绪 + 模块切换（验收 A1/A2）。
 * 后续里程碑将在此挂载各模块渲染函数（M2 单词 → M5 测验/进度）。
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;

  /* ---- 数据就绪提示（开发辅助） ---- */
  if (DATA) {
    var nWords = (DATA.words && DATA.words.length) || 0;
    var nGrammar = (DATA.grammar && DATA.grammar.length) || 0;
    var nReading = (DATA.reading && DATA.reading.length) || 0;
    console.info('[N5] 数据已载入：词 ' + nWords + ' · 语法 ' + nGrammar + ' · 阅读 ' + nReading);
  } else {
    console.error('[N5] 数据未载入：请确认 data/*.js 已在本页之前加载');
  }

  /* ---- 模块路由（单词 / 语法 / 阅读 / 测验） ---- */
  var navs = Array.prototype.slice.call(document.querySelectorAll('.nav a[data-v]'));
  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));

  function switchTo(v) {
    var target = document.getElementById('view-' + v);
    if (!target) return;
    navs.forEach(function (a) { a.classList.toggle('cur', a.getAttribute('data-v') === v); });
    views.forEach(function (sec) { sec.classList.remove('active'); });
    target.classList.add('active');
    target.scrollTop = 0;
    if (history.replaceState) history.replaceState(null, '', '#view-' + v);
  }

  navs.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      switchTo(a.getAttribute('data-v'));
    });
  });

  /* 刷新后按锚点恢复模块（如 #view-reading） */
  var m = (location.hash || '').match(/^#view-(words|grammar|reading|quiz)$/);
  if (m) switchTo(m[1]);

  /* ---- 报头学习统计（M5 接入进度后更新；暂为 0） ---- */
  function setStat(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val);
  }
  setStat('st-learned', 0);
  setStat('st-quiz', 0);
  setStat('st-wrong', 0);

  /* ---- 各视图索引信息（数据规模，随数据实时显示） ---- */
  function setIdx(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  if (DATA) {
    setIdx('idx-words', 'TOTAL ' + ((DATA.words && DATA.words.length) || 0) + ' · 待学习');
    setIdx('idx-grammar', ((DATA.grammar && DATA.grammar.length) || 0) + ' PATTERNS · N5');
    setIdx('idx-reading', ((DATA.reading && DATA.reading.length) || 0) + ' PASSAGES · 难度 N5');
  }
})();
