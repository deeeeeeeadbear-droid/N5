/* ==========================================================
 * N5 日语学习 MVP — 单词模块（M2）
 * 验收：A3 列表全量渲染 / A4 即时搜索 / A5 词卡详情（注音例句）
 *       / A6 前后翻页 + 已学标记持久化（localStorage）
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var WORDS = (DATA && DATA.words) || [];
  if (!WORDS.length) { console.error('[N5] 单词模块：词库为空'); return; }

  var state = { idx: 0, filter: '' };

  function $(id) { return document.getElementById(id); }

  function pad3(n) { return ('00' + n).slice(-3); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- 列表 ---------- */
  function matches(w, q) {
    if (!q) return true;
    var hay = (w.kana + ' ' + (w.kanji || '') + ' ' + w.meaning + ' ' + w.pos).toLowerCase();
    return hay.indexOf(q.toLowerCase()) >= 0;
  }

  function renderRows() {
    var ul = $('w-rows');
    if (!ul) return;
    var q = state.filter;
    var html = '';
    var shown = 0;
    WORDS.forEach(function (w, i) {
      if (!matches(w, q)) return;
      shown++;
      var learnedCls = N5Progress.has(w.id) ? ' learned' : '';
      var head = w.kanji || w.kana;
      var kanaLine = w.kanji ? '<em>' + esc(w.kana) + '</em>' : '<em>' + esc(w.kana) + '（纯假名）</em>';
      html += '<li data-i="' + i + '"' + (i === state.idx ? ' class="sel"' : '') + '>' +
        '<span class="num">' + pad3(i + 1) + '</span>' +
        '<span class="w-main"><b>' + esc(head) + '</b>' + kanaLine + '</span>' +
        '<span class="pos">' + esc(w.pos) + '</span>' +
        '<span class="w-me' + learnedCls + '">' + esc(w.meaning) + '</span>' +
        '</li>';
    });
    ul.innerHTML = html;

    var empty = $('w-empty');
    if (empty) empty.hidden = shown > 0;
    var count = $('w-count');
    if (count) count.textContent = q ? '命中 ' + shown + ' / ' + WORDS.length + ' 词' : '共 ' + WORDS.length + ' 词 · 已学 ' + N5Progress.count();

    Array.prototype.forEach.call(ul.querySelectorAll('li'), function (li) {
      li.addEventListener('click', function () { pick(+li.getAttribute('data-i')); });
    });
    // 选中的行滚动到可视区
    var sel = ul.querySelector('li.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- 详情 ---------- */
  function pick(i) {
    state.idx = i;
    var w = WORDS[i];
    $('d-no').textContent = 'WORD NO.' + pad3(i + 1) + ' / ' + WORDS.length;
    $('d-pos').textContent = w.pos;
    $('d-kana').textContent = w.kana;
    $('d-kanji').textContent = w.kanji || '';
    $('d-me').textContent = w.meaning;
    $('d-ex').innerHTML = N5Annot.toHTML(w.example.jp);
    $('d-excn').textContent = w.example.cn;
    $('d-note').textContent = w.kanji ? '汉字写法：「' + w.kanji + '」' : '纯假名词（无汉字写法）';
    renderRows();
    syncMark();
  }

  function syncMark() {
    var w = WORDS[state.idx];
    var btn = $('d-learn');
    if (!btn) return;
    var learned = N5Progress.has(w.id);
    btn.classList.toggle('on', learned);
    btn.textContent = learned ? '✓ 已学' : '✓ 标记为已学';
  }

  /* ---------- 头部统计联动 ---------- */
  function refreshMeta() {
    var idx = $('idx-words');
    if (idx) idx.textContent = 'TOTAL ' + WORDS.length + ' · 已学 ' + N5Progress.count();
    var st = $('st-learned');
    if (st) st.textContent = String(N5Progress.count());
    var cnt = $('w-count');
    if (cnt && !state.filter) cnt.textContent = '共 ' + WORDS.length + ' 词 · 已学 ' + N5Progress.count();
  }

  /* ---------- 事件 ---------- */
  function bind() {
    var search = $('w-search');
    if (search) {
      search.addEventListener('input', function () {
        state.filter = this.value.trim();
        renderRows();
      });
    }
    var learn = $('d-learn');
    if (learn) learn.addEventListener('click', function () {
      var w = WORDS[state.idx];
      N5Progress.toggle(w.id);
      syncMark();
      renderRows();
      refreshMeta();
    });
    var prev = $('d-prev');
    if (prev) prev.addEventListener('click', function () {
      pick((state.idx + WORDS.length - 1) % WORDS.length);
    });
    var next = $('d-next');
    if (next) next.addEventListener('click', function () {
      pick((state.idx + 1) % WORDS.length);
    });
    N5Progress.onChange(function () { syncMark(); refreshMeta(); renderRows(); });
  }

  function init() {
    bind();
    refreshMeta();
    pick(0);
  }

  window.N5Words = { init: init, pick: pick, refreshMeta: refreshMeta };
})();
