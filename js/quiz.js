/* ==========================================================
 * N5 日语学习 MVP — 测验与进度模块（M5）
 * 验收：A12 一轮10题/4选项不重复/正确项唯一；A13 即时反馈；
 *       A14 结算得分与错题一致；A15 只测错题并从清单移除答对词；
 *       A16 边界不崩溃；A17 错词入清单/答对移除并持久化；
 *       A18 记录刷新后保留；A19 重置二次确认清空 n5app.*；A20 无存储降级
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var WORDS = (DATA && DATA.words) || [];
  var P = window.N5Progress;
  if (!WORDS.length || !P) { console.error('[N5] 测验模块：词库或进度不可用'); return; }

  var ROUND_SIZE = 10;
  var LETTERS = ['A', 'B', 'C', 'D'];

  var round = null; // { mode:'all'|'wrong', items:[{id,dir,opts:[{id,w,label,sub}],ans}], pos, answers:[bool] }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function byId(id) {
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i].id === id) return WORDS[i];
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

  /* ================= 出题 ================= */
  /* 生成一道题：dir 'cn2jp' 看中文选词 / 'jp2cn' 看词选中文；4 个不重复选项 */
  function makeQuestion(wid) {
    var w = byId(wid);
    var dir = Math.random() < 0.5 ? 'cn2jp' : 'jp2cn';
    // 干扰项：优先同词性，其次随机；标签去重；保证不与题干重复
    var others = WORDS.filter(function (x) { return x.id !== w.id; });
    var samePos = shuffle(others.filter(function (x) { return x.pos === w.pos; }));
    var rest = shuffle(others.filter(function (x) { return x.pos !== w.pos; }));
    var pool = samePos.concat(rest);
    var chosen = [];
    function candLabel(x) { return dir === 'cn2jp' ? (x.kanji || x.kana) : x.meaning; }
    for (var k = 0; k < pool.length && chosen.length < 3; k++) {
      var cand = pool[k];
      if (cand.id === w.id) continue;
      if (candLabel(cand) === candLabel(w)) continue;                  // 标签与题干重复
      if (chosen.some(function (c) { return candLabel(c) === candLabel(cand); })) continue; // 选项间重复
      chosen.push(cand);
    }
    // 兜底（词库极小等极端情形，A16：至少保证 id 不重复、正确项唯一）
    for (var r = 0; r < pool.length && chosen.length < 3; r++) {
      var c2 = pool[r];
      if (c2.id === w.id || chosen.some(function (c) { return c.id === c2.id; })) continue;
      chosen.push(c2);
    }
    var opts = chosen.concat([w]);
    opts = shuffle(opts);
    return {
      id: w.id,
      dir: dir,
      ans: opts.indexOf(w),
      opts: opts.map(function (x, idx) {
        return {
          id: x.id,
          idx: idx,
          main: dir === 'cn2jp' ? (x.kanji || x.kana) : x.meaning,
          sub: dir === 'cn2jp' ? (x.kanji ? x.kana : '') : (x.kana + (x.kanji ? '（' + x.kanji + '）' : ''))
        };
      })
    };
  }

  function buildRound(mode) {
    var poolIds;
    if (mode === 'wrong') {
      var wrong = P.wrongList();
      poolIds = shuffle(wrong).slice(0, ROUND_SIZE);
      if (!poolIds.length) return null;
    } else {
      poolIds = shuffle(WORDS.map(function (w) { return w.id; })).slice(0, ROUND_SIZE);
    }
    return {
      mode: mode,
      count: poolIds.length,
      items: poolIds.map(makeQuestion),
      pos: 0,
      answers: []
    };
  }

  /* ================= 作答 ================= */
  function renderQuestion() {
    var q = round.items[round.pos];
    var w = byId(q.id);
    var play = $('qz-play');
    play.hidden = false;
    $('qz-result').hidden = true;

    $('qz-dir').textContent = q.dir === 'cn2jp' ? '中 → 日' : '日 → 中';
    $('qz-pos').textContent = 'QUESTION ' + (round.pos + 1) + ' / ' + round.count +
      (round.mode === 'wrong' ? ' · 错题专测' : '');
    $('qz-prog').style.width = Math.round(((round.pos) / round.count) * 100) + '%';
    $('qz-q').innerHTML = (q.dir === 'cn2jp')
      ? '「' + esc(w.meaning) + '」对应的日语是？'
      : '「' + esc(w.kana) + (w.kanji ? '（' + esc(w.kanji) + '）' : '') + '」的中文意思是？';

    var optsBox = $('qz-opts');
    optsBox.innerHTML = '';
    q.opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.opt = String(o.idx);
      var k = document.createElement('span'); k.className = 'k'; k.textContent = LETTERS[o.idx];
      var t = document.createElement('span'); t.className = 'o-main'; t.textContent = o.main;
      b.appendChild(k); b.appendChild(t);
      if (o.sub) { var s2 = document.createElement('span'); s2.className = 'o-sub'; s2.textContent = o.sub; b.appendChild(s2); }
      optsBox.appendChild(b);
    });

    var fb = $('qz-fb');
    fb.classList.remove('show', 'is-ok', 'is-ng');
    var next = $('qz-next');
    next.disabled = true;
    next.textContent = round.pos + 1 === round.count ? '查看结果 →' : '下一题 →';
    $('qz-hint').textContent = '作答后即时反馈 · 答错的词将加入错题清单（答对则移除）';
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

    var w = byId(q.id);
    var fb = $('qz-fb');
    fb.classList.add('show', right ? 'is-ok' : 'is-ng');
    var wText = (w.kanji || w.kana) + '（' + w.kana + '）';
    if (right) {
      fb.querySelector('.ok').textContent = '✓ 正解 —— 「' + w.meaning + '」对应 ' + wText + '。';
      if (P.hasWrong(q.id)) P.removeWrong(q.id); // A15/A17：答对移除错题
    } else {
      fb.querySelector('.ng').textContent = '✕ 不对 —— 正确答案是 ' + wText + '（' + w.meaning + '）。已记入错题清单。';
      P.addWrong(q.id); // A17：答错沉淀
    }
    $('qz-next').disabled = false;
  }

  function finishRound() {
    var total = round.count;
    var correct = round.answers.filter(Boolean).length;
    var wrongIds = [];
    round.items.forEach(function (q, i) {
      if (!round.answers[i]) wrongIds.push(q.id);
    });
    P.addQuizRecord({ date: nowStr(), total: total, correct: correct, wrongIds: wrongIds }); // A14/A18
    renderResult(total, correct, wrongIds);
  }

  /* ================= 结算页 ================= */
  function renderResult(total, correct, wrongIds) {
    $('qz-play').hidden = true;
    var res = $('qz-result');
    res.hidden = false;
    $('qz-score').textContent = correct + ' / ' + total;
    $('qz-score-note').textContent = (total - correct === 0)
      ? '满分！太棒了。'
      : (correct / total >= 0.7 ? '不错！继续加油。' : '再接再厉，错题已记入清单。');

    var wl = $('qz-wrong-list'); // 本错题词（答错即时已入清单）
    wl.innerHTML = '';
    wrongIds.forEach(function (id) {
      var w = byId(id);
      if (!w) return;
      var li = document.createElement('li');
      li.innerHTML = '<b>' + esc(w.kanji || w.kana) + '</b><em>' + esc(w.kana) + '</em><span>' + esc(w.meaning) + '</span>';
      wl.appendChild(li);
    });
    if (!wrongIds.length) wl.innerHTML = '<p class="pv-none">本轮全对，没有错题 🎉</p>';

    var cl = $('qz-correct-list');
    cl.innerHTML = '';
    round.items.forEach(function (q, i) {
      if (!round.answers[i]) return;
      var w = byId(q.id);
      if (!w) return;
      var li = document.createElement('li');
      li.innerHTML = '<b>' + esc(w.kanji || w.kana) + '</b><em>' + esc(w.kana) + '</em><span>' + esc(w.meaning) + '</span>';
      cl.appendChild(li);
    });

    var nWrong = P.wrongCount();
    var btn = $('qz-again-wrong');
    btn.disabled = nWrong === 0;
    btn.textContent = '只测错题（' + nWrong + '）';
    $('qz-again-all').textContent = '再测一轮（10 题）';
    refreshStats();
    renderProgress();
  }

  /* ================= 进度视图 ================= */
  function renderProgress() {
    if (!document.getElementById('view-progress')) return;
    var nLearned = P.learnedCount();
    var history = P.quizHistory();
    var last = P.lastQuiz();
    $('pv-learned').textContent = nLearned + ' / ' + WORDS.length;
    $('pv-rounds').textContent = history.length;
    $('pv-last').textContent = last ? last.correct + '/' + last.total : '—';
    $('pv-wrong').textContent = P.wrongCount();

    // 测验历史（最近在前）
    var hl = $('pv-history');
    if (history.length === 0) {
      hl.innerHTML = '<p class="pv-none">还没有测验记录 —— 去「测验」完成第一轮吧</p>';
    } else {
      hl.innerHTML = '';
      history.slice().reverse().forEach(function (r) {
        var li = document.createElement('li');
        li.className = 'hrow';
        var rate = r.total ? Math.round((r.correct / r.total) * 100) : 0;
        li.innerHTML = '<span class="h-date">' + esc(r.date) + '</span>' +
          '<span class="h-score' + (rate >= 70 ? ' good' : '') + '">' + r.correct + '/' + r.total + '</span>' +
          '<span class="h-rate">' + rate + '%</span>' +
          '<span class="h-wrong">错 ' + r.wrongIds.length + '</span>';
        hl.appendChild(li);
      });
    }

    // 错题清单（点击跳转词卡）
    var wl = $('pv-wronglist');
    var wrong = P.wrongList();
    if (wrong.length === 0) {
      wl.innerHTML = '<p class="pv-none">暂无错题，继续保持！</p>';
    } else {
      wl.innerHTML = '';
      wrong.forEach(function (id) {
        var w = byId(id);
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

  /* ================= 绑定 ================= */
  function bindQuiz() {
    var opts = $('qz-opts');
    opts.addEventListener('click', function (e) {
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
    $('qz-again-all').addEventListener('click', function () { startRound('all'); });
    $('qz-again-wrong').addEventListener('click', function () {
      if (P.wrongCount() === 0) {
        $('qz-hint2').textContent = '当前没有错题，已为你开始全库测验。';
        startRound('all');
      } else startRound('wrong');
    });
  }

  function bindReset() {
    var zone = $('pv-reset-zone');
    var btn = $('pv-reset');
    if (!zone || !btn) return;
    btn.addEventListener('click', function () { zone.hidden = false; });
    $('pv-reset-yes').addEventListener('click', function () {
      P.clearAll(); // A19
      zone.hidden = true;
      renderProgress();
      if (window.N5Words) N5Words.refreshMeta();
    });
    $('pv-reset-no').addEventListener('click', function () { zone.hidden = true; });
  }

  function startRound(mode) {
    round = buildRound(mode);
    var hint = $('qz-hint2');
    if (!round) {
      hint.textContent = '错题清单为空 —— 已开始全库测验（10 题）。';
      round = buildRound('all');
      if (!round) return;
    } else if (mode === 'wrong') {
      hint.textContent = '本轮共 ' + round.count + ' 题（全部来自错题清单，答对即移出）。';
    } else {
      hint.textContent = '';
    }
    renderQuestion();
  }

  function init() {
    bindQuiz();
    bindReset();
    P.onChange(function () { renderProgress(); refreshStats(); if (window.N5Words) N5Words.refreshMeta(); });
    if (document.getElementById('view-progress')) renderProgress();
    refreshStats();
  }

  window.N5Quiz = {
    init: init,
    renderProgress: renderProgress,
    refreshStats: refreshStats,
    startRound: startRound,
    onShown: function (v) { if (v === 'progress') renderProgress(); if (v === 'quiz' && !round) startRound('all'); }
  };
})();
