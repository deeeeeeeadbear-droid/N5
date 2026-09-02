/* ==========================================================
 * N5 日语学习 — 进度备份 导出/导入（阶段 B · B5，spec §3.12/§4.8，验收 A44–A46）
 * 导出：JSON 下载（全部学习键 + app/schema/exportedAt）
 * 导入：文件解析 → 必需键校验 → 按当前数据存在性过滤 → 摘要二次确认 → 整体替换
 * ========================================================== */
(function () {
  'use strict';

  var DATA = window.N5_DATA;
  var P = window.N5Progress;
  if (!P) { console.error('[N5] 备份模块：进度存储不可用'); return; }

  var WORDS = (DATA && DATA.words) || [];
  var QBANK = (DATA && DATA.quizGrammar) || [];
  var PASS = (DATA && DATA.reading) || [];
  var SCHEMA = 2;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* id 集合（存在性过滤用） */
  var wSet = new Set(WORDS.map(function (w) { return w.id; }));
  var gqSet = new Set(QBANK.map(function (q) { return q.id; }));
  var pSet = new Set(PASS.map(function (p) { return p.id; }));

  function uniqueFilter(arr, set) {
    var seen = new Set();
    var out = [];
    arr.forEach(function (x) {
      if (typeof x === 'string' && set.has(x) && !seen.has(x)) { seen.add(x); out.push(x); }
    });
    return out;
  }

  /* ================= 导入解析与清洗 ================= */
  /* 返回 { ok:true, payload, meta, counts } 或 { ok:false, reason } */
  function parseImport(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, reason: '文件不是有效的 N5 备份（顶层须为对象）。' };
    }
    var need = ['learned', 'quiz', 'wrong', 'wrongG', 'readDone'];
    for (var i = 0; i < need.length; i++) {
      if (!Array.isArray(obj[need[i]])) {
        return { ok: false, reason: '缺少必需字段「' + need[i] + '」（数组）—— 无法识别为本应用备份。' };
      }
    }
    var schemaWarn = (typeof obj.schema === 'number' && obj.schema > SCHEMA)
      ? '（schema ' + obj.schema + ' 高于当前 ' + SCHEMA + '：文件来自更新版本，将按字段容错导入）' : '';

    var payload = {
      learned: uniqueFilter(obj.learned, wSet),
      wrong: uniqueFilter(obj.wrong, wSet),
      wrongG: uniqueFilter(obj.wrongG, gqSet),
      readDone: uniqueFilter(obj.readDone, pSet),
      quiz: obj.quiz.filter(function (r) {
        return r && (r.type === 'words' || r.type === 'grammar') &&
          Array.isArray(r.wrongIds) && (r.seen === undefined || Array.isArray(r.seen));
      }).map(function (r) {
        var set = r.type === 'words' ? wSet : gqSet;
        return {
          type: r.type,
          date: typeof r.date === 'string' ? r.date : '',
          total: isFinite(+r.total) ? Math.max(0, (+r.total) | 0) : 0,
          correct: isFinite(+r.correct) ? Math.max(0, (+r.correct) | 0) : 0,
          wrongIds: uniqueFilter(r.wrongIds, set),
          seen: Array.isArray(r.seen) ? uniqueFilter(r.seen, set) : undefined
        };
      }),
      cards: {},
      grad: 0,
      settings: {}
    };
    if (obj.cards && typeof obj.cards === 'object' && !Array.isArray(obj.cards)) {
      Object.keys(obj.cards).forEach(function (id) {
        var c = obj.cards[id];
        if (!c || typeof c !== 'object') return;
        var set = c.k === 'g' ? gqSet : wSet;
        if (typeof id === 'string' && set.has(id)) payload.cards[id] = c;
      });
    }
    if (isFinite(+obj.grad) && +obj.grad >= 0) payload.grad = Math.floor(+obj.grad);
    if (obj.settings && typeof obj.settings === 'object') payload.settings = obj.settings;

    var counts = {
      learned: payload.learned.length,
      quiz: payload.quiz.length,
      wrong: payload.wrong.length,
      wrongG: payload.wrongG.length,
      cards: Object.keys(payload.cards).length,
      grad: payload.grad,
      readDone: payload.readDone.length
    };
    return { ok: true, payload: payload, counts: counts, schemaWarn: schemaWarn };
  }

  /* ================= UI ================= */
  function setMsg(text, kind) {
    var m = $('bz-msg');
    if (!m) return;
    m.textContent = text;
    m.classList.remove('ok', 'err');
    if (kind) m.classList.add(kind);
  }

  function fileName() {
    var d = new Date();
    return 'N5-进度备份-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '.json';
  }

  function doExport() {
    var bak = P.backup();
    var payload = {
      app: '日本語N5 进度备份',
      schema: SCHEMA,
      exportedAt: new Date().toISOString(),
      learned: bak.learned,
      quiz: bak.quiz,
      wrong: bak.wrong,
      wrongG: bak.wrongG,
      readDone: bak.readDone,
      cards: bak.cards,
      grad: bak.grad,
      settings: bak.settings
    };
    var blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    var sum = '已学 ' + bak.learned.length + ' · 测验 ' + bak.quiz.length + ' 条 · 错题 ' +
      (bak.wrong.length + bak.wrongG.length) + ' · 复习卡 ' + Object.keys(bak.cards).length +
      '（毕业 ' + bak.grad + '）· 已读 ' + bak.readDone.length;
    setMsg('✓ 已导出 ' + fileName() + '（' + sum + '）——请妥善保存该文件。', 'ok');
  }

  var pending = null; // 待确认导入的清洗后 payload

  function doImport(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var obj;
      try { obj = JSON.parse(String(reader.result)); } catch (e) { obj = null; }
      var res = parseImport(obj);
      if (!res.ok) {
        pending = null;
        setMsg('✕ ' + res.reason + ' 当前进度未改变。', 'err');
        return;
      }
      pending = res.payload;
      var c = res.counts;
      var info = $('bz-info');
      if (info) {
        info.innerHTML =
          '<b>将整体覆盖当前本机进度：</b>' + (res.schemaWarn ? '<i>' + esc(res.schemaWarn) + '</i>' : '') +
          '<br>已学 ' + c.learned + ' 词 · 测验记录 ' + c.quiz + ' 条 · 错题 ' + (c.wrong + c.wrongG) +
          '（词 ' + c.wrong + ' / 语 ' + c.wrongG + '）· 复习卡 ' + c.cards + '（毕业 ' + c.grad + '）· 阅读已读 ' + c.readDone + ' 篇' +
          '<br>确认后立即生效；此操作不可撤销（可先导出当前进度留档）。';
      }
      var zone = $('bz-confirm');
      if (zone) zone.hidden = false;
      setMsg('请核对上方摘要后确认导入，或点「取消」。');
    };
    reader.readAsText(file);
  }

  function bind() {
    var ex = $('bz-export');
    if (ex) ex.addEventListener('click', function () {
      try { doExport(); } catch (e) { setMsg('✕ 导出失败：' + e.message, 'err'); }
    });
    var im = $('bz-import');
    var file = $('bz-file');
    if (im && file) {
      im.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        doImport(f);
        file.value = '';
      });
    }
    var yes = $('bz-yes');
    var no = $('bz-no');
    var zone = $('bz-confirm');
    if (yes) yes.addEventListener('click', function () {
      if (!pending) return;
      var ok = false;
      try { ok = P.restore(pending); } catch (e) { ok = false; }
      if (ok) {
        setMsg('✓ 已导入并覆盖当前进度，全部视图已刷新' + (P.degraded() ? '（当前为内存会话，刷新后不保留，请注意）' : '。'), 'ok');
      } else {
        setMsg('✕ 导入失败：数据清洗未通过，进度未改变。', 'err');
      }
      pending = null;
      if (zone) zone.hidden = true;
    });
    if (no) no.addEventListener('click', function () {
      pending = null;
      if (zone) zone.hidden = true;
      setMsg('已取消导入，当前进度未改变。');
    });
  }

  function init() {
    if (!$('view-progress')) return;
    bind();
  }

  window.N5Backup = { init: init };
})();
