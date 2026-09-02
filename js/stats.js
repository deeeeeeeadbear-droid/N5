/* ==========================================================
 * N5 日语学习 — 掌握率统计模块（阶段 B · B3，spec §3.10，验收 A37–A40）
 * 渲染进度页「掌握率统计」面板；任一进度变更（onChange）后即时刷新。
 * 口径（与 spec §3.10 表一致）：
 *   单词掌握：learnedWords/词库总数 + 按词性分布行
 *   阅读进度：readDone/阅读总数
 *   复习毕业：毕业 ÷（毕业＋学习中），附今日到期数
 *   语法自测：近 20 轮语法轮 seen[] 去重覆盖 X/题库数 + 词/语历史加权均分
 *             + 当前语法错题按 gid 关联语法分组分布
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var P = window.N5Progress;
  var WORDS = (DATA && DATA.words) || [];
  var QBANK = (DATA && DATA.quizGrammar) || [];
  var PASS = (DATA && DATA.reading) || [];
  var GRAMMAR = (DATA && DATA.grammar) || [];
  if (!P || !WORDS.length) { console.error('[N5] 掌握率模块：进度或词库不可用'); return; }

  var GROUP_ORDER = ['句型', '动词活用', '助词', '未关联'];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* gq id → 语法分组（经 gid 关联；无 gid 或查不到归「未关联」） */
  var gqGroup = {};
  var gramById = {};
  GRAMMAR.forEach(function (g) { gramById[g.id] = g; });
  QBANK.forEach(function (q) {
    var g = q.gid ? gramById[q.gid] : null;
    gqGroup[q.id] = (g && g.group) || '未关联';
  });

  /* ================= 渲染 ================= */
  function render() {
    if (!$('sv-word-pct')) return;

    /* —— 单词掌握 —— */
    var total = WORDS.length;
    var learned = P.learnedCount();
    var wp = pct(learned, total);
    $('sv-word-pct').textContent = wp + '%';
    $('sv-word-n').textContent = learned + ' / ' + total;
    $('sv-word-bar').style.width = wp + '%';

    var posMap = {};
    WORDS.forEach(function (w) {
      var m = posMap[w.pos] || (posMap[w.pos] = { total: 0, done: 0 });
      m.total++;
      if (P.hasLearned(w.id)) m.done++;
    });
    var posKeys = Object.keys(posMap).sort(function (a, b) {
      return posMap[b].total - posMap[a].total || (a < b ? -1 : 1);
    });
    var rows = $('sv-word-pos');
    rows.innerHTML = posKeys.map(function (k) {
      var m = posMap[k];
      var p = pct(m.done, m.total);
      return '<li><span class="p">' + esc(k) + '</span>' +
        '<span class="t"><i style="width:' + p + '%"></i></span>' +
        '<span class="n">' + m.done + '/' + m.total + '</span></li>';
    }).join('');

    /* —— 阅读进度 —— */
    var rTotal = PASS.length;
    var rDone = P.readDoneCount();
    var rp = pct(rDone, rTotal);
    $('sv-read-pct').textContent = rp + '%';
    $('sv-read-n').textContent = rDone + ' / ' + rTotal;
    $('sv-read-bar').style.width = rp + '%';

    /* —— 复习毕业 —— */
    var grad = P.reviewGrad();
    var active = Object.keys(P.reviewAll()).length;
    var denom = grad + active;
    var gp = pct(grad, denom);
    $('sv-grad-pct').textContent = gp + '%';
    $('sv-grad-n').textContent = grad + ' / ' + denom;
    $('sv-grad-bar').style.width = gp + '%';
    var t = today();
    var cards = P.reviewAll();
    var due = 0;
    Object.keys(cards).forEach(function (id) { if (cards[id].due <= t) due++; });
    var dueEl = $('sv-grad-due');
    if (dueEl) dueEl.textContent = String(due);

    /* —— 语法自测覆盖（近 20 轮 seen）与均分 —— */
    var seen = new Set();
    var sum = { words: [0, 0], grammar: [0, 0] }; // [correct, total]
    P.quizHistory().forEach(function (r) {
      var key = r.type === 'grammar' ? 'grammar' : 'words';
      if (r.total > 0) {
        sum[key][0] += (r.correct || 0);
        sum[key][1] += r.total;
      }
      if (r.type === 'grammar' && Array.isArray(r.seen)) {
        r.seen.forEach(function (id) { seen.add(id); });
      }
    });
    var cover = 0;
    seen.forEach(function (id) { if (QBANK.some(function (q) { return q.id === id; })) cover++; });
    var cp = pct(cover, QBANK.length);
    $('sv-gq-pct').textContent = cp + '%';
    $('sv-gq-n').textContent = cover + ' / ' + QBANK.length;
    $('sv-gq-bar').style.width = cp + '%';
    var aw = $('sv-avg-w');
    if (aw) aw.textContent = sum.words[1] ? Math.round((sum.words[0] / sum.words[1]) * 100) + '%' : '—';
    var ag = $('sv-avg-g');
    if (ag) ag.textContent = sum.grammar[1] ? Math.round((sum.grammar[0] / sum.grammar[1]) * 100) + '%' : '—';

    /* 当前语法错题分组分布 */
    var gCnt = {};
    P.grammarWrongList().forEach(function (id) {
      var g = gqGroup[id] || '未关联';
      gCnt[g] = (gCnt[g] || 0) + 1;
    });
    var chips = $('sv-gq-chips');
    if (chips) {
      var keys = Object.keys(gCnt);
      if (!keys.length) {
        chips.innerHTML = '<i class="sv-chip none">暂无语法错题</i>';
      } else {
        keys.sort(function (a, b) {
          var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
          ia = ia < 0 ? 99 : ia; ib = ib < 0 ? 99 : ib;
          return ia - ib || gCnt[b] - gCnt[a];
        });
        chips.innerHTML = keys.map(function (k) {
          return '<i class="sv-chip">' + esc(k) + ' <b>' + gCnt[k] + '</b></i>';
        }).join('');
      }
    }
  }

  function init() {
    if (!$('view-progress') || !$('sv-word-pct')) return;
    P.onChange(render);
    render();
  }

  window.N5Stats = { init: init, render: render };
})();
