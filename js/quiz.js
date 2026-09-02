/* ==========================================================
 * N5 日语学习 MVP — 测验与进度模块（M5 + v1.7 语法自测）
 * 单词测验（验收 A12–A20）+ 语法测验（验收 A21–A23，示例题库）
 * 结构：round = { type:'word'|'grammar', src:'all'|'wrong',
 *                items:[…], pos, answers:[bool] }
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var WORDS = (DATA && DATA.words) || [];
  var QBANK = (DATA && DATA.quizGrammar) || [];
  var P = window.N5Progress;
  if (!WORDS.length || !P) { console.error('[N5] 测验模块：词库或进度不可用'); return; }

  var ROUND_SIZE = 10;
  var LETTERS = ['A', 'B', 'C', 'D'];

  var round = null; // 当前轮

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function byWord(id) {
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i].id === id) return WORDS[i];
    return null;
  }
  function byGQ(id) {
    for (var i = 0; i < QBANK.length; i++) if (QBANK[i].id === id) return QBANK[i];
    return null;
  }
  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function nowStr() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function pickN(list, n) { return shuffle(list).slice(0, n); }

  /* ================= 出题 ================= */
  function makeWordQ(wid) {
    var w = byWord(wid);
    var dir = Math.random() < 0.5 ? 'cn2jp' : 'jp2cn';
    var others = WORDS.filter(function (x) { return x.id !== w.id; });
    var samePos = shuffle(others.filter(function (x) { return x.pos === w.pos; }));
    var rest = shuffle(others.filter(function (x) { return x.pos !== w.pos; }));
    var pool = samePos.concat(rest);
    var chosen = [];
    function candLabel(x) { return dir === 'cn2jp' ? (x.kanji || x.kana) : x.meaning; }
    for (var k = 0; k < pool.length && chosen.length < 3; k++) {
      var cand = pool[k];
      if (candLabel(cand) === candLabel(w)) continue;
      if (chosen.some(function (c) { return candLabel(c) === candLabel(cand); })) continue;
      chosen.push(cand);
    }
    for (var r = 0; r < pool.length && chosen.length < 3; r++) { // 兜底：id 不重复即可（A16）
      var c2 = pool[r];
      if (c2.id === w.id || chosen.some(function (c) { return c.id === c2.id; })) continue;
      chosen.push(c2);
    }
    var opts = shuffle(chosen.concat([w]));
    return {
      kind: 'word', id: w.id, dir: dir,
      ans: opts.indexOf(w),
      opts: opts.map(function (x, idx) {
        return {
          id: x.id, idx: idx,
          main: dir === 'cn2jp' ? (x.kanji || x.kana) : x.meaning,
          sub: dir === 'cn2jp' ? (x.kanji ? x.kana : '') : (x.kana + (x.kanji ? '（' + x.kanji + '）' : ''))
        };
      })
    };
  }

  function makeGQ(gid) {
    var q = byGQ(gid);
    var texts = q.options.slice();
    var ansTxt = q.options[q.answer];
    var sh = shuffle(texts);
    return {
      kind: 'grammar', id: q.id,
      q: q.question, hint: q.hint, explain: q.explain,
      ans: sh.indexOf(ansTxt),
      opts: sh.map(function (txt, idx) { return { id: gid, idx: idx, txt: txt }; })
    };
  }

  function buildRound(type, src) {
    var poolIds;
    if (type === 'word') {
      poolIds = src === 'wrong' ? pickN(P.wrongList(), ROUND_SIZE) : pickN(WORDS.map(function (w) { return w.id; }), ROUND_SIZE);
      if (!poolIds.length) return null;
      return { type: 'word', src: src, count: poolIds.length, items: poolIds.map(makeWordQ), pos: 0, answers: [] };
    }
    poolIds = src === 'wrong' ? pickN(P.grammarWrongList(), ROUND_SIZE) : pickN(QBANK.map(function (q) { return q.id; }), Math.min(ROUND_SIZE, QBANK.length));
    if (!poolIds.length) return null;
    return { type: 'grammar', src: src, count: poolIds.length, items: poolIds.map(makeGQ), pos: 0, answers: [] };
  }

  /* ================= 面板切换 ================= */
  function showMenu() {
    var menu = $('qz-menu');
    if (menu) menu.hidden = false;
    var play = $('qz-play'); if (play) play.hidden = true;
    var res = $('qz-result'); if (res) res.hidden = true;
    $('qz-m-word-n').textContent = String(P.wrongCount());
    $('qz-m-grammar-n').textContent = String(P.grammarWrongCount());
    var gw = $('qz-m-gwrong');
    if (gw) {
      var n = P.grammarWrongCount();
      gw.hidden = n === 0;
      gw.textContent = '只测语法错题（' + n + '）';
    }
    var h2 = $('qz-hint2');
    if (h2) h2.textContent = '';
  }

  /* ================= 答题面板 ================= */
  function renderQuestion() {
    $('qz-menu').hidden = true;
    var play = $('qz-play');
    play.hidden = false;
    $('qz-result').hidden = true;

    var q = round.items[round.pos];
    var chip = $('qz-dir');
    var posTxt = $('qz-pos');
    if (q.kind === 'word') {
      chip.textContent = q.dir === 'cn2jp' ? '中 → 日' : '日 → 中';
      posTxt.textContent = 'QUESTION ' + (round.pos + 1) + ' / ' + round.count + (round.src === 'wrong' ? ' · 错词专测' : '');
      var w = byWord(q.id);
      $('qz-q').innerHTML = q.dir === 'cn2jp'
        ? '「' + esc(w.meaning) + '」对应的日语是？'
        : '「' + esc(w.kana) + (w.kanji ? '（' + esc(w.kanji) + '）' : '') + '」的中文意思是？';
    } else {
      chip.textContent = '语法';
      posTxt.textContent = 'QUESTION ' + (round.pos + 1) + ' / ' + round.count + (round.src === 'wrong' ? ' · 错题专测' : ' · 示例题库');
      var parts = q.q.split('＿');
      $('qz-q').innerHTML = parts.map(function (p, i) {
        return esc(p) + (i < parts.length - 1 ? '<span class="blank">＿</span>' : '');
      }).join('');
    }
    $('qz-prog').style.width = Math.round((round.pos / round.count) * 100) + '%';

    var hint = $('qz-hint');
    if (q.kind === 'grammar') {
      hint.textContent = '提示：' + q.hint;
      hint.style.color = 'var(--ink2)';
    } else {
      hint.textContent = '作答后即时反馈 · 答错即入错题清单，答对移出';
      hint.style.color = '';
    }

    var optsBox = $('qz-opts');
    optsBox.innerHTML = '';
    q.opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.opt = String(o.idx);
      var k = document.createElement('span'); k.className = 'k'; k.textContent = LETTERS[o.idx];
      b.appendChild(k);
      if (q.kind === 'word') {
        var t = document.createElement('span'); t.className = 'o-main'; t.textContent = o.main;
        b.appendChild(t);
        if (o.sub) { var s2 = document.createElement('span'); s2.className = 'o-sub'; s2.textContent = o.sub; b.appendChild(s2); }
      } else {
        var g = document.createElement('span'); g.className = 'o-main'; g.textContent = o.txt;
        b.appendChild(g);
      }
      optsBox.appendChild(b);
    });

    var fb = $('qz-fb');
    fb.classList.remove('show', 'is-ok', 'is-ng');
    var next = $('qz-next');
    next.disabled = true;
    next.textContent = round.pos + 1 === round.count ? '查看结果 →' : '下一题 →';
  }

  function onAnswer(optIdx) {
    var q = round.items[round.pos];
    var right = optIdx === q.ans;
    round.answers.push(right);

    var optsBox = $('qz-opts');
    Array.prototype.forEach.call(optsBox.querySelectorAll('.opt'), function (b) {
      b.disabled = true;
      var i = +b.dataset.opt;
      b.classList.toggle('on-correct', i === q.ans);
      b.classList.toggle('on-wrong', i === optIdx && !right);
    });

    var fb = $('qz-fb');
    fb.classList.add('show', right ? 'is-ok' : 'is-ng');
    if (q.kind === 'word') {
      var w = byWord(q.id);
      var wText = (w.kanji || w.kana) + '（' + w.kana + '）';
      if (right) {
        fb.querySelector('.ok').textContent = '✓ 正解 —— 「' + w.meaning + '」对应 ' + wText + '。';
        if (P.hasWrong(q.id)) P.removeWrong(q.id);
      } else {
        fb.querySelector('.ng').textContent = '✕ 不对 —— 正确答案是 ' + wText + '（' + w.meaning + '）。已记入错题清单。';
        P.addWrong(q.id);
      }
    } else {
      var gq = byGQ(q.id);
      var ansTxt = q.opts[q.ans].txt;
      if (right) {
        fb.querySelector('.ok').textContent = '✓ 正解 —— 解析：' + gq.explain;
        if (P.hasGrammarWrong(q.id)) P.removeGrammarWrong(q.id);
      } else {
        fb.querySelector('.ng').textContent = '✕ 答错了 —— 正确答案是「' + ansTxt + '」。解析：' + gq.explain;
        P.addGrammarWrong(q.id);
      }
    }
    // v3.0·B1 SRS：作答结果同步复习卡（答错建档/重置为 0 档，答对升级已有卡，spec §3.9）
    if (window.N5Review) {
      try { window.N5Review.onQuizResult(q.kind, q.id, right); } catch (e) { console.error(e); }
    }
    $('qz-next').disabled = false;
  }

  function finishRound() {
    var total = round.count;
    var correct = round.answers.filter(Boolean).length;
    var wrongIds = [];
    round.items.forEach(function (q, i) { if (!round.answers[i]) wrongIds.push(q.id); });
    P.addQuizRecord({ type: round.type, date: nowStr(), total: total, correct: correct, wrongIds: wrongIds });
    renderResult(total, correct, wrongIds);
  }

  /* ================= 结算 ================= */
  function renderResult(total, correct, wrongIds) {
    $('qz-play').hidden = true;
    $('qz-menu').hidden = true;
    var res = $('qz-result');
    res.hidden = false;
    $('qz-score').textContent = correct + ' / ' + total;
    $('qz-score-note').textContent = (total - correct === 0)
      ? '满分！太棒了。'
      : (correct / total >= 0.7 ? '不错！继续加油。' : '再接再厉，错题已记入清单。');

    function wordRow(w) {
      return '<li><b>' + esc(w.kanji || w.kana) + '</b><em>' + esc(w.kana) + '</em><span>' + esc(w.meaning) + '</span></li>';
    }
    function gqRow(gq) {
      return '<li><b>' + esc(gq.options[gq.answer]) + '</b><em>' + esc(gq.hint) + '</em><span>解析：' + esc(gq.explain) + '</span></li>';
    }

    var wl = $('qz-wrong-list');
    wl.innerHTML = '';
    wrongIds.forEach(function (id) {
      if (round.type === 'word') { var w = byWord(id); if (w) wl.innerHTML += wordRow(w); }
      else { var gq = byGQ(id); if (gq) wl.innerHTML += gqRow(gq); }
    });
    if (!wrongIds.length) wl.innerHTML = '<p class="pv-none">本轮全对，没有错题 🎉</p>';

    var cl = $('qz-correct-list');
    cl.innerHTML = '';
    round.items.forEach(function (q, i) {
      if (!round.answers[i]) return;
      if (round.type === 'word') { var w = byWord(q.id); if (w) cl.innerHTML += wordRow(w); }
      else { var gq = byGQ(q.id); if (gq) cl.innerHTML += gqRow(gq); }
    });

    var nWrong = round.type === 'word' ? P.wrongCount() : P.grammarWrongCount();
    var btn = $('qz-again-wrong');
    btn.disabled = nWrong === 0;
    btn.textContent = round.type === 'word'
      ? '只测错词（' + nWrong + '）'
      : '只测语法错题（' + nWrong + '）';
    $('qz-again-all').textContent = round.type === 'word' ? '再测一轮（10 题单词）' : '再测语法（10 题）';
    var h2 = $('qz-hint2');
    if (h2) h2.textContent = round.type === 'word'
      ? '本轮已记入测验历史；答对的错词已移出清单。'
      : '本轮为语法题，已记入测验历史（标注“语法”）。';
    refreshStats();
    renderProgress();
  }

  /* ================= 进度视图 ================= */
  function renderProgress() {
    if (!document.getElementById('view-progress')) return;
    var history = P.quizHistory();
    var last = P.lastQuiz();
    $('pv-learned').textContent = P.learnedCount() + ' / ' + WORDS.length;
    $('pv-rounds').textContent = history.length;
    $('pv-last').textContent = last ? last.correct + '/' + last.total : '—';
    $('pv-wrong').textContent = P.wrongCount();

    var hl = $('pv-history');
    if (!history.length) {
      hl.innerHTML = '<p class="pv-none">还没有测验记录 —— 去「测验」完成第一轮吧</p>';
    } else {
      hl.innerHTML = '';
      history.slice().reverse().forEach(function (r) {
        var li = document.createElement('li');
        li.className = 'hrow';
        var rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
        li.innerHTML =
          '<span class="h-type ' + (r.type === 'grammar' ? 't-g' : 't-w') + '">' + (r.type === 'grammar' ? '语' : '词') + '</span>' +
          '<span class="h-date">' + esc(r.date) + '</span>' +
          '<span class="h-score' + (rate >= 70 ? ' good' : '') + '">' + r.correct + '/' + r.total + '</span>' +
          '<span class="h-rate">' + rate + '%</span>' +
          '<span class="h-wrong">错 ' + r.wrongIds.length + '</span>';
        hl.appendChild(li);
      });
    }

    var wl = $('pv-wronglist');
    var wrong = P.wrongList();
    if (!wrong.length) {
      wl.innerHTML = '<p class="pv-none">暂无错词，继续保持！</p>';
    } else {
      wl.innerHTML = '';
      wrong.forEach(function (id) {
        var w = byWord(id);
        if (!w) return;
        var li = document.createElement('li');
        li.className = 'wrow';
        li.innerHTML = '<b>' + esc(w.kanji || w.kana) + '</b><em>' + esc(w.kana) + '</em><span>' + esc(w.meaning) + '</span><i>→</i>';
        li.addEventListener('click', function () {
          if (window.N5App && window.N5Words) { window.N5App.go('words'); window.N5Words.pickById(id); }
        });
        wl.appendChild(li);
      });
    }
    refreshStats();
  }

  function refreshStats() {
    var el;
    el = $('st-learned'); if (el) el.textContent = String(P.learnedCount());
    el = $('st-quiz'); if (el) el.textContent = String(P.quizCount());
    el = $('st-wrong'); if (el) el.textContent = String(P.wrongCount());
    var idx = $('idx-progress');
    if (idx) idx.textContent = '本机存储 · 已学 ' + P.learnedCount() + ' · 测验 ' + P.quizCount() + ' 回';
  }

  /* ================= 事件绑定 ================= */
  function startRound(type, src) {
    round = buildRound(type, src || 'all');
    var h2 = $('qz-hint2');
    if (!round) {
      if (type === 'grammar' && src === 'wrong') h2.textContent = '当前没有语法错题 —— 已开始全题库语法测验。';
      else if (type === 'word' && src === 'wrong') h2.textContent = '当前没有错词 —— 已开始全库测验。';
      round = buildRound(type, 'all');
      if (!round) { h2.textContent = '题库为空，请检查数据。'; showMenu(); return; }
    }
    renderQuestion();
  }

  function bindQuiz() {
    $('qz-m-word').addEventListener('click', function () { startRound('word', 'all'); });
    $('qz-m-grammar').addEventListener('click', function () { startRound('grammar', 'all'); });
    var gw = $('qz-m-gwrong');
    if (gw) gw.addEventListener('click', function () { startRound('grammar', 'wrong'); });

    $('qz-opts').addEventListener('click', function (e) {
      if (!round) return;
      var b = e.target.closest ? e.target.closest('.opt') : null;
      if (!b || b.disabled) return;
      onAnswer(+b.dataset.opt);
    });
    $('qz-next').addEventListener('click', function () {
      if (this.disabled || !round) return;
      if (round.pos + 1 < round.count) { round.pos++; renderQuestion(); }
      else finishRound();
    });
    $('qz-again-all').addEventListener('click', function () {
      startRound(round ? round.type : 'word', 'all');
    });
    $('qz-again-wrong').addEventListener('click', function () {
      startRound(round.type, 'wrong');
    });
  }

  function bindReset() {
    var zone = $('pv-reset-zone');
    var btn = $('pv-reset');
    if (!zone || !btn) return;
    btn.addEventListener('click', function () { zone.hidden = false; });
    $('pv-reset-yes').addEventListener('click', function () {
      P.clearAll();
      zone.hidden = true;
      renderProgress();
      if (window.N5Words) window.N5Words.refreshMeta();
    });
    $('pv-reset-no').addEventListener('click', function () { zone.hidden = true; });
  }

  function init() {
    bindQuiz();
    bindReset();
    P.onChange(function () { renderProgress(); refreshStats(); if (window.N5Words) window.N5Words.refreshMeta(); });
    if (document.getElementById('view-progress')) renderProgress();
    refreshStats();
    showMenu();
  }

  window.N5Quiz = {
    init: init,
    renderProgress: renderProgress,
    refreshStats: refreshStats,
    startRound: startRound,
    showMenu: showMenu,
    onShown: function (v) {
      if (v === 'progress') renderProgress();
      if (v === 'quiz') {
        if (round && round.pos < round.count) renderQuestion();       // 续答进行中的轮
        else if (round && round.pos >= round.count) { /* 停留在结算 */ }
        else showMenu();
      }
    }
  };
})();
