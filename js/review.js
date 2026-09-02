/* ==========================================================
 * N5 日语学习 — 错题间隔复习模块（阶段 B · B1，spec §3.9）
 * 复习卡对象：{ k:'w'|'g', st:0-5 连续记得次数, due:'YYYY-MM-DD', last:'YYYY-MM-DD' }
 *   k 'w'  → word id（w0001…） ；k 'g' → 语法题 id（gq0001…）
 * 调度：记得 档位+1 并按间隔表重排；第 6 次记得毕业（移出错题清单、累计 +1）
 *       模糊 档位不变明天再来；忘了 归零明天再来；测验答错 建档/重置 0 档今天到期
 * 间隔表（连续记得 n 次后的下次间隔）：[1, 2, 4, 7, 15] 天
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var WORDS = (DATA && DATA.words) || [];
  var QBANK = (DATA && DATA.quizGrammar) || [];
  var P = window.N5Progress;
  if (!P) { console.error('[N5] 复习模块：进度存储不可用'); return; }

  var LADDER = [1, 2, 4, 7, 15]; // LADDER[n-1] = 第 n 次「记得」后的间隔天数
  var GRAD_AT = 5;                // st 达 5 后再「记得」一次即毕业（第 6 次）

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function today() { return dayStr(new Date()); }
  function addDays(base, n) {
    var d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return dayStr(d);
  }
  function fmtDay(s) {
    if (!s) return '—';
    var t = today();
    if (s === t) return '今天';
    if (s === addDays(t, 1)) return '明天';
    var d = new Date(s + 'T00:00:00');
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function byWord(id) {
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i].id === id) return WORDS[i];
    return null;
  }
  function byGQ(id) {
    for (var i = 0; i < QBANK.length; i++) if (QBANK[i].id === id) return QBANK[i];
    return null;
  }

  /* ================= 调度 ================= */
  /* 成功一次：未达毕业档则升档并排期；已达 GRAD_AT 档则毕业 */
  function onSuccess(id, card) {
    if (card.st >= GRAD_AT) { // 第 6 次「记得」→ 毕业
      graduate(id, card);
      return 'grad';
    }
    card.st += 1;
    card.due = addDays(today(), LADDER[card.st - 1]);
    card.last = today();
    P.reviewSet(id, card);
    return 'ok';
  }

  function graduate(id, card) {
    if (card.k === 'w') P.removeWrong(id); else P.removeGrammarWrong(id);
    P.reviewRemove(id);
    P.reviewGradAdd(1);
  }

  /* 测验作答回调（quiz.js）：kind 'word'|'grammar'；答错建档/重置，答对升级已有卡 */
  function onQuizResult(kind, id, right) {
    var k = kind === 'word' ? 'w' : 'g';
    var card = P.reviewGet(id);
    if (right) {
      if (card) onSuccess(id, card);
      return;
    }
    P.reviewSet(id, { k: k, st: 0, due: today(), last: today() });
  }

  /* 存量错题一次性迁移（首次进入复习视图前调用，幂等） */
  function migrate() {
    var t = today();
    P.wrongList().forEach(function (id) {
      if (!P.reviewGet(id)) P.reviewSet(id, { k: 'w', st: 0, due: t, last: '' });
    });
    P.grammarWrongList().forEach(function (id) {
      if (!P.reviewGet(id)) P.reviewSet(id, { k: 'g', st: 0, due: t, last: '' });
    });
  }

  /* ================= 渲染 ================= */
  function render() {
    var list = $('rv-list');
    if (!list) return;
    var empty = $('rv-empty');
    var none = $('rv-none');
    var cards = P.reviewAll();
    var ids = Object.keys(cards);
    var t = today();

    var due = [], active = ids.length;
    ids.forEach(function (id) { if (cards[id].due <= t) due.push(id); });
    due.sort(function (a, b) {
      var c = cards[a].due < cards[b].due ? -1 : cards[a].due > cards[b].due ? 1 : 0;
      return c || (a < b ? -1 : 1);
    });

    /* 统计卡 */
    var el = $('rv-due'); if (el) el.textContent = String(due.length);
    el = $('rv-active'); if (el) el.textContent = String(active);
    el = $('rv-grad'); if (el) el.textContent = String(P.reviewGrad());
    el = $('rv-wrong'); if (el) el.textContent = String(P.wrongCount() + P.grammarWrongCount());
    el = $('idx-review');
    if (el) el.textContent = '到期 ' + due.length + ' · 学习中 ' + active + ' · 毕业 ' + P.reviewGrad();

    if (!active) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      if (none) none.hidden = true;
      return;
    }
    if (!due.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = true;
      if (none) none.hidden = false;
      var nd = $('rv-none-d');
      if (nd) {
        var nextDue = ids.map(function (id) { return cards[id].due; }).sort()[0];
        nd.textContent = '学习中 ' + active + ' 张复习卡 · 最近一批 ' + fmtDay(nextDue) + ' 到期，届时再来巩固。';
      }
      return;
    }
    if (empty) empty.hidden = true;
    if (none) none.hidden = true;

    var html = '';
    due.forEach(function (id) {
      var card = cards[id];
      html += cardHTML(id, card);
    });
    list.innerHTML = html;
  }

  function cardHTML(id, card) {
    if (card.k === 'w') return wordCard(id, card);
    return gqCard(id, card);
  }

  function wordCard(id, card) {
    var w = byWord(id);
    if (!w) return '';
    var main = w.kanji || w.kana;
    var kana = w.kanji ? w.kana : '（纯假名）';
    var ex = N5Annot && N5Annot.toHTML ? N5Annot.toHTML(w.example.jp) : esc(w.example.jp);
    return '' +
      '<li class="rv-card" data-id="' + esc(id) + '">' +
        '<div class="rv-card-head">' +
          '<span class="rv-k w">单词</span>' +
          '<span class="rv-no">' + esc(id) + '</span>' +
          '<span class="rv-st">档位 ' + card.st + ' · 到期 ' + fmtDay(card.due) + '</span>' +
        '</div>' +
        '<div class="rv-face">' +
          '<p class="q">「' + esc(w.meaning) + '」用日语怎么说？</p>' +
          '<p class="sub">词性：' + esc(w.pos) + ' —— 先回忆，再点「显示答案」核对</p>' +
        '</div>' +
        '<div class="rv-ans">' +
          '<p class="lab">ANSWER 答案</p>' +
          '<p class="a-main">' + esc(kana) + (w.kanji ? ' <b>' + esc(main) + '</b>' : '') + '</p>' +
          '<p class="a-me">例：' + ex + '</p>' +
          '<p class="a-me">' + esc(w.example.cn) + '</p>' +
        '</div>' +
        '<div class="rv-acts">' +
          '<button class="btn rv-reveal" type="button">显示答案</button>' +
          '<span class="rv-grades">' +
            '<button class="btn rv-g g-ok" type="button" data-act="ok">记得 ✓</button>' +
            '<button class="btn rv-g g-mid" type="button" data-act="fuzzy">模糊 ~</button>' +
            '<button class="btn rv-g g-no" type="button" data-act="forgot">忘了 ✗</button>' +
          '</span>' +
        '</div>' +
      '</li>';
  }

  function gqCard(id, card) {
    var gq = byGQ(id);
    if (!gq) return '';
    var parts = gq.question.split('＿');
    var qHtml = esc(parts[0]);
    for (var i = 1; i < parts.length; i++) {
      qHtml += '<span class="blank">＿</span>' + esc(parts[i]);
    }
    return '' +
      '<li class="rv-card" data-id="' + esc(id) + '">' +
        '<div class="rv-card-head">' +
          '<span class="rv-k g">语法</span>' +
          '<span class="rv-no">' + esc(id) + '</span>' +
          '<span class="rv-st">档位 ' + card.st + ' · 到期 ' + fmtDay(card.due) + '</span>' +
        '</div>' +
        '<div class="rv-face">' +
          '<p class="q">' + qHtml + '</p>' +
          '<p class="sub">提示：' + esc(gq.hint) + ' —— 先回忆，再点「显示答案」核对</p>' +
        '</div>' +
        '<div class="rv-ans">' +
          '<p class="lab">ANSWER 答案与解析</p>' +
          '<p class="a-main">' + esc(gq.options[gq.answer]) + '</p>' +
          '<p class="a-me">' + esc(gq.explain) + '</p>' +
        '</div>' +
        '<div class="rv-acts">' +
          '<button class="btn rv-reveal" type="button">显示答案</button>' +
          '<span class="rv-grades">' +
            '<button class="btn rv-g g-ok" type="button" data-act="ok">记得 ✓</button>' +
            '<button class="btn rv-g g-mid" type="button" data-act="fuzzy">模糊 ~</button>' +
            '<button class="btn rv-g g-no" type="button" data-act="forgot">忘了 ✗</button>' +
          '</span>' +
        '</div>' +
      '</li>';
  }

  /* ================= 自评 ================= */
  function grade(id, act) {
    var card = P.reviewGet(id);
    var msg = $('rv-msg');
    if (!card) return;
    var t = today();
    var text;
    if (act === 'ok') {
      var res = onSuccess(id, card);
      text = res === 'grad'
        ? '🎉 第 6 次记得 —— 毕业！已从错题清单移除。'
        : '✓ 记得 —— 档位 ' + card.st + '，下次复习 ' + fmtDay(card.due) + '（间隔 ' + LADDER[card.st - 1] + ' 天）。';
    } else if (act === 'fuzzy') {
      card.due = addDays(t, 1);
      card.last = t;
      P.reviewSet(id, card);
      text = '~ 模糊 —— 档位不变，明天 ' + fmtDay(card.due) + ' 再复习。';
    } else {
      card.st = 0;
      card.due = addDays(t, 1);
      card.last = t;
      P.reviewSet(id, card);
      text = '✗ 忘了 —— 已归零，明天 ' + fmtDay(card.due) + ' 再来。';
    }
    if (msg) msg.textContent = text;
    render();
  }

  function bind() {
    var list = $('rv-list');
    if (!list) return;
    list.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var li = btn.closest ? btn.closest('.rv-card') : null;
      if (!li) return;
      var id = li.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act) grade(id, act);
      else if (btn.classList.contains('rv-reveal')) li.classList.add('revealed');
    });
    var go1 = $('rv-go-quiz');
    var go2 = $('rv-go-quiz2');
    if (go1) go1.addEventListener('click', function () { if (window.N5App) window.N5App.go('quiz'); });
    if (go2) go2.addEventListener('click', function () { if (window.N5App) window.N5App.go('quiz'); });
  }

  function init() {
    migrate();
    bind();
    P.onChange(render);
    render();
  }

  window.N5Review = {
    init: init,
    onQuizResult: onQuizResult,
    render: render
  };
})();
