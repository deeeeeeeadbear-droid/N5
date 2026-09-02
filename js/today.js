/* ==========================================================
 * N5 日语学习 — 今日学习路径面板（阶段 B · B4，spec §3.11，验收 A41–A43）
 * 进度页顶部建议链：① 复习到期 → ② 学习新词 → ③ 做一轮测验 → ④ 阅读一篇
 * 状态均由现有存储键派生（不新增键）；onChange 与进入进度页时刷新。
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var P = window.N5Progress;
  var WORDS = (DATA && DATA.words) || [];
  var PASS = (DATA && DATA.reading) || [];
  if (!P || !WORDS.length) { console.error('[N5] 今日路径模块：进度或词库不可用'); return; }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function isToday(dt) { return !!(dt && String(dt).slice(0, 10) === today()); }

  /* ================= 状态派生 ================= */
  function stepStates() {
    var t = today();

    /* ① 复习到期 */
    var cards = P.reviewAll();
    var active = Object.keys(cards).length;
    var due = 0;
    Object.keys(cards).forEach(function (id) { if (cards[id].due <= t) due++; });
    var review;
    if (!active) {
      review = { cls: 'na', tag: '暂无卡', desc: '测验答错会自动建档成复习卡 —— 先做一轮测验吧', act: '去测验', v: 'quiz' };
    } else if (due > 0) {
      review = { cls: 'todo', tag: '待办 · ' + due + ' 张', desc: '今日到期 ' + due + ' 张 · 学习中 ' + active + ' 张，先清完再学新的', act: '去复习', v: 'review' };
    } else {
      review = { cls: 'done', tag: '已完成', desc: '今日到期已清空 · 学习中 ' + active + ' 张按间隔表等待复习' };
    }

    /* ② 学习新词 */
    var learned = P.learnedCount();
    var total = WORDS.length;
    var left = total - learned;
    var words;
    if (left > 0) {
      words = { cls: 'todo', tag: '剩 ' + left + ' 词', desc: '已学 ' + learned + ' / ' + total + ' · 建议每日新学 ≥5 词（在词卡点「标记为已学」）', act: '去单词', v: 'words' };
    } else {
      words = { cls: 'done', tag: '已完成', desc: '词库 ' + total + ' 词已全部学完' };
    }

    /* ③ 做一轮测验 */
    var last = P.lastQuiz();
    var quiz;
    if (last && isToday(last.date)) {
      quiz = { cls: 'done', tag: '今日已测', desc: '最近一轮：' + last.correct + ' / ' + last.total + '（' + (last.type === 'grammar' ? '语法' : '单词') + '）' };
    } else {
      quiz = { cls: 'todo', tag: '待办', desc: '完成一轮单词或语法测验，巩固今日所学', act: '去测验', v: 'quiz' };
    }

    /* ④ 阅读一篇 */
    var rTotal = PASS.length;
    var rDone = P.readDoneCount();
    var rLeft = rTotal - rDone;
    var read;
    if (rLeft > 0) {
      read = { cls: 'todo', tag: '剩 ' + rLeft + ' 篇', desc: '已读 ' + rDone + ' / ' + rTotal + ' · 读完一篇并点「标记已读」', act: '去阅读', v: 'reading' };
    } else {
      read = { cls: 'done', tag: '已完成', desc: '全部 ' + rTotal + ' 篇已读完' };
    }

    return [
      { no: '01', name: '复习到期', st: review },
      { no: '02', name: '学习新词', st: words },
      { no: '03', name: '做一轮测验', st: quiz },
      { no: '04', name: '阅读一篇', st: read }
    ];
  }

  /* ================= 渲染 ================= */
  function render() {
    var box = $('td-steps');
    if (!box) return;
    var steps = stepStates();
    var todo = 0;
    steps.forEach(function (s) { if (s.st.cls === 'todo') todo++; });
    var sum = $('td-sum');
    if (sum) {
      sum.textContent = todo > 0
        ? '今日待办 ' + todo + ' 项 · 按 复习 → 新词 → 测验 → 阅读 顺序完成'
        : '四步全部完成 🎉 可以休息，或去复习下一批到期卡';
    }
    box.innerHTML = steps.map(function (s) {
      var st = s.st;
      var btn = st.act
        ? '<button class="td-go" type="button" data-v="' + esc(st.v) + '">' + esc(st.act) + ' →</button>'
        : '<span class="td-ok">✓</span>';
      return '<div class="td-step ' + st.cls + '">' +
        '<div class="td-top"><span class="td-no">STEP ' + s.no + '</span><b>' + esc(s.name) + '</b></div>' +
        '<p class="td-desc">' + esc(st.desc) + '</p>' +
        '<div class="td-foot"><span class="td-tag">' + esc(st.tag) + '</span>' + btn + '</div>' +
        '</div>';
    }).join('');
  }

  function bind() {
    var box = $('td-steps');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button.td-go') : null;
      if (!b) return;
      var v = b.getAttribute('data-v');
      if (v && window.N5App) window.N5App.go(v);
    });
  }

  function init() {
    if (!$('view-progress') || !$('td-steps')) return;
    bind();
    P.onChange(render);
    render();
  }

  window.N5Today = { init: init, render: render };
})();
