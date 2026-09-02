/* ==========================================================
 * N5 日语学习 MVP — 语法模块（M3）
 * 验收：A7 全部条目渲染且分组正确
 *       / A8 点击条目查看五要素详情（句型/含义/接续/例句/注意）
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var GRAM = (DATA && DATA.grammar) || [];
  if (!GRAM.length) { console.error('[N5] 语法模块：数据为空'); return; }

  var state = { idx: 0 };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- 分组列表 ---------- */
  function renderRows() {
    var ul = $('g-rows');
    if (!ul) return;
    var html = '';
    var currentGroup = null;
    GRAM.forEach(function (g, i) {
      if (g.group !== currentGroup) {
        currentGroup = g.group;
        html += '<li class="glab"><div class="grp-label">组：' + esc(currentGroup) + '</div></li>';
      }
      html += '<li class="gitem' + (i === state.idx ? ' sel' : '') + '" data-i="' + i + '">' +
        '<span class="num">' + esc('0' + (i + 1)).slice(-2) + '</span>' +
        '<span class="g-main"><b>' + esc(g.pattern) + '</b><em>' + esc(g.meaning) + '</em></span>' +
        '</li>';
    });
    ul.innerHTML = html;
    Array.prototype.forEach.call(ul.querySelectorAll('li.gitem'), function (li) {
      li.addEventListener('click', function () { pick(+li.getAttribute('data-i')); });
    });
    var sel = ul.querySelector('li.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- 五要素详情 ---------- */
  function pick(i) {
    state.idx = i;
    var g = GRAM[i];
    $('g-no').textContent = 'GRAMMAR NO.' + ('0' + (i + 1)).slice(-2) + ' / ' + GRAM.length;
    $('g-group').textContent = '组：' + g.group;
    $('g-pattern').textContent = g.pattern;
    $('g-me').textContent = g.meaning;
    $('g-conn').textContent = g.connect;
    $('g-exs').innerHTML = g.examples.map(function (ex) {
      return '<div class="ex"><b>' + N5Annot.toHTML(ex.jp) + '</b><span>' + esc(ex.cn) + '</span></div>';
    }).join('');
    $('g-note').textContent = g.note || '—';
    renderRows();
  }

  /* ---------- 索引信息 ---------- */
  function refreshMeta() {
    var idx = $('idx-grammar');
    if (idx) {
      var g = GRAM[state.idx];
      idx.textContent = GRAM.length + ' PATTERNS · ' + (g ? '当前：' + g.group + ' ' + g.pattern : '');
    }
  }

  function init() {
    if (!$('view-grammar')) return;
    pick(0);
    refreshMeta();
  }

  window.N5Grammar = { init: init, pick: pick, refreshMeta: refreshMeta };
})();
