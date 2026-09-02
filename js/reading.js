/* ==========================================================
 * N5 日语学习 MVP — 阅读模块（M4）
 * 验收：A9 短文完整阅读、汉字全部注音（数据已校验）
 *       / A10 生词点击弹释义浮层、可关闭、无残留状态
 *       / A11 中文翻译开关即时生效
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var PASS = (DATA && DATA.reading) || [];
  var P = window.N5Progress;
  if (!PASS.length) { console.error('[N5] 阅读模块：数据为空'); return; }

  var state = { idx: 0, hit: -1 };
  var pop = null;      // 释义浮层节点
  var popAnchor = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- 正文渲染：注音 + 生词标记 ---------- */
  function bodyHTML(body) {
    var segs = String(body).split('*');
    var html = '';
    var gi = 0;
    for (var si = 0; si < segs.length; si++) {
      if (si % 2 === 0) {
        html += N5Annot.toHTML(segs[si]);
      } else {
        html += '<span class="gloss" data-i="' + gi + '">' + N5Annot.toHTML(segs[si]) + '</span>';
        gi++;
      }
    }
    return html;
  }

  /* ---------- 渲染当前篇目 ---------- */
  function renderPassage() {
    var p = PASS[state.idx];
    $('r-title').textContent = p.title;
    $('r-titlecn').textContent = p.titleCn;
    $('r-body').innerHTML = bodyHTML(p.body);
    $('r-cn').textContent = p.cn;
    $('r-cn').classList.remove('open');
    var tg = $('r-tr-toggle');
    if (tg) tg.textContent = '显示翻译';
    $('r-desc').textContent = '第 ' + (state.idx + 1) + ' 篇 · 汉字注音：完整 · 生词 ' + p.gloss.length + ' 个';
    syncDoneUI(); // 已读状态（v3.0·B3）

    // 生词栏
    var ul = $('r-gloss');
    if (ul) {
      ul.innerHTML = p.gloss.map(function (g, i) {
        return '<li data-i="' + i + '"><span class="n">' + esc('0' + (i + 1)).slice(-2) + '</span>' +
          '<span class="g-w">' + esc(g.word) + ' <span class="g-k">' + esc(g.kana) + '</span></span>' +
          '<span class="g-m">' + esc(g.meaning) + '</span></li>';
      }).join('');
      Array.prototype.forEach.call(ul.querySelectorAll('li'), function (li) {
        li.addEventListener('click', function () {
          var i = +li.getAttribute('data-i');
          setHit(i);
          openPop(i, li);
        });
      });
    }
    state.hit = -1;
    closePop();
  }

  /* ---------- 已读标记（v3.0·B3，spec §3.10） ---------- */
  function isDone() {
    var p = PASS[state.idx];
    return !!(P && p && P.hasReadDone(p.id));
  }
  function syncDoneUI() {
    var p = PASS[state.idx];
    if (!p) return;
    var done = isDone();
    var cnt = $('r-count');
    if (cnt) cnt.textContent = 'PASSAGE ' + (state.idx + 1) + ' / ' + PASS.length + (done ? ' · 已读 ✓' : ' · 未读') + ' · ' + p.title;
    var idx = $('idx-reading');
    if (idx) idx.textContent = 'PASSAGE ' + (state.idx + 1) + ' / ' + PASS.length + (done ? ' · 已读' : '') + ' · ' + p.title;
    var b = $('r-done');
    if (b) {
      b.classList.toggle('on', done);
      b.textContent = done ? '已读 ✓ · 点击取消' : '✓ 标记已读';
    }
  }
  function bindDone() {
    var b = $('r-done');
    if (!b || !P) return;
    b.addEventListener('click', function () {
      var p = PASS[state.idx];
      if (!p) return;
      P.toggleReadDone(p.id); // onChange 会联动进度掌握率
      syncDoneUI();
    });
  }

  /* ---------- 高亮联动 ---------- */
  function setHit(i) {
    state.hit = i;
    document.querySelectorAll('#r-body .gloss').forEach(function (sp) {
      sp.classList.toggle('hit', +sp.getAttribute('data-i') === i);
    });
    var lis = document.querySelectorAll('#r-gloss li');
    if (lis) Array.prototype.forEach.call(lis, function (li) {
      li.classList.toggle('hit', +li.getAttribute('data-i') === i);
    });
  }

  /* ---------- 释义浮层 ---------- */
  function buildPop() {
    pop = document.createElement('div');
    pop.className = 'pop';
    pop.innerHTML =
      '<div class="pop-head"><b class="pop-w"></b><span class="pop-k"></span>' +
      '<span class="pop-pos"></span><button class="pop-x" type="button" aria-label="关闭">✕</button></div>' +
      '<p class="pop-me"></p>' +
      '<p class="pop-tip">再次点击生词或点击其他位置可关闭</p>';
    document.body.appendChild(pop);
    pop.querySelector('.pop-x').addEventListener('click', function (e) {
      e.stopPropagation();
      closePop();
    });
  }

  function openPop(i, anchor) {
    if (!pop) buildPop();
    var p = PASS[state.idx];
    var g = p.gloss[i];
    if (!g) return;
    if (pop.classList.contains('show') && popAnchor === anchor) { closePop(); return; }
    popAnchor = anchor;
    pop.querySelector('.pop-w').textContent = g.word;
    pop.querySelector('.pop-k').textContent = g.kana;
    pop.querySelector('.pop-pos').textContent = g.pos || '';
    pop.querySelector('.pop-me').textContent = g.meaning;
    pop.classList.add('show');

    var r = anchor.getBoundingClientRect();
    var pw = pop.offsetWidth || 340;
    var ph = pop.offsetHeight || 140;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var x = Math.min(Math.max(8, r.left), vw - pw - 8);
    var y = r.bottom + 12;
    if (y + ph > vh - 8) y = Math.max(8, r.top - ph - 12);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  }

  function closePop() {
    if (!pop) return;
    pop.classList.remove('show');
    popAnchor = null;
  }

  /* ---------- 翻译开关 ---------- */
  function bindToggles() {
    var tg = $('r-tr-toggle');
    var cn = $('r-cn');
    if (tg && cn) {
      tg.addEventListener('click', function () {
        var open = cn.classList.toggle('open');
        tg.textContent = open ? '隐藏翻译' : '显示翻译';
      });
    }
  }

  /* ---------- 篇目切换 ---------- */
  function bindNav() {
    var prev = $('r-prev');
    var next = $('r-next');
    if (prev) prev.addEventListener('click', function () {
      state.idx = (state.idx + PASS.length - 1) % PASS.length;
      renderPassage();
    });
    if (next) next.addEventListener('click', function () {
      state.idx = (state.idx + 1) % PASS.length;
      renderPassage();
    });
  }

  function bindGlobal() {
    // 正文生词点击
    var body = $('r-body');
    if (body) {
      body.addEventListener('click', function (e) {
        var sp = e.target.closest ? e.target.closest('.gloss') : null;
        if (sp) {
          var i = +sp.getAttribute('data-i');
          if (state.hit === i && pop && pop.classList.contains('show')) {
            setHit(-1); closePop();
          } else {
            setHit(i);
            openPop(i, sp);
          }
        }
      });
    }
    // 点击浮层外关闭；滚动与 Esc 关闭
    document.addEventListener('click', function (e) {
      if (!pop || !pop.classList.contains('show')) return;
      if (pop.contains(e.target)) return;
      var t = e.target;
      if (t && t.closest && t.closest('.gloss, #r-gloss li')) return; // 由各自处理器接管
      setHit(-1);
      closePop();
    });
    document.addEventListener('scroll', function () { closePop(); }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setHit(-1); closePop(); }
    });
  }

  function init() {
    if (!$('view-reading')) return;
    bindToggles();
    bindNav();
    bindDone();
    bindGlobal();
    if (P) P.onChange(function () { syncDoneUI(); }); // 外部变更（如重置）后同步当前篇目标记
    renderPassage();
  }

  window.N5Reading = { init: init, renderPassage: renderPassage };
})();
