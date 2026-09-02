/* ==========================================================
 * N5 日语学习 MVP — 应用入口脚本
 * 职责：数据就绪提示 / 模块路由（单词01–进度05）/ 模块初始化
 * 视图切换钩子：各模块注册 onShown（如测验进入自动开局、进度进入即刷新）
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;

  /* ---- 数据就绪提示（开发辅助） ---- */
  if (DATA) {
    console.info('[N5] 数据已载入：词 ' + ((DATA.words && DATA.words.length) || 0) +
      ' · 语法 ' + ((DATA.grammar && DATA.grammar.length) || 0) +
      ' · 阅读 ' + ((DATA.reading && DATA.reading.length) || 0));
  } else {
    console.error('[N5] 数据未载入：请确认 data/*.js 已在本页之前加载');
  }

  /* ---- 模块路由 ---- */
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
    // 模块视图钩子（进度刷新 / 测验首次进入自动开局）
    if (window.N5Quiz && window.N5Quiz.onShown) {
      try { N5Quiz.onShown(v); } catch (e) { console.error(e); }
    }
  }

  navs.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      switchTo(a.getAttribute('data-v'));
    });
  });

  window.N5App = { go: switchTo };

  /* 刷新后按锚点恢复模块（#view-words … #view-review） */
  var m = (location.hash || '').match(/^#view-(words|grammar|reading|quiz|progress|review)$/);
  if (m) switchTo(m[1]);

  /* ---- 各模块初始化（M2 单词 · M3 语法 · M4 阅读 · M5 测验/进度） ---- */
  if (window.N5Words && document.getElementById('view-words')) N5Words.init();
  if (window.N5Grammar && document.getElementById('view-grammar')) N5Grammar.init();
  if (window.N5Reading && document.getElementById('view-reading')) N5Reading.init();
  if (window.N5Quiz && document.getElementById('view-quiz')) N5Quiz.init();
  if (window.N5Review && document.getElementById('view-review')) N5Review.init();
  if (window.N5Stats && document.getElementById('view-progress')) N5Stats.init();
  if (window.N5Today && document.getElementById('view-progress')) N5Today.init();
  if (window.N5Backup && document.getElementById('view-progress')) N5Backup.init();
})();
