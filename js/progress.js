/* ==========================================================
 * N5 日语学习 MVP — 本地进度（localStorage，spec §4.5）
 * 键：
 *   n5app.learnedWords  已学单词 id[]
 *   n5app.quizHistory   测验记录 {date,total,correct,wrongIds[]}[]（保留最近 20 条）
 *   n5app.wrongWords    当前错题清单 id[]
 *   n5app.wrongGrammar  当前语法错题 id[]（v1.7）
 *   n5app.reviewCards   复习卡（v3.0·B1，spec §3.9）：id → {k,st,due,last}
 *   n5app.reviewGraduated  累计毕业卡数（v3.0·B1）
 *   n5app.settings      测验设置（v3.0·B2，spec §3.5）：{count, scope, timer}
 *   n5app.readDone      阅读已读篇目 id[]（v3.0·B3，spec §3.10）
 *   n5app.version       数据版本 "1"
 * 备份：backup()/restore() 供导出/导入使用（v3.0·B5，spec §3.12/§4.8）
 * 设计约定：localStorage 不可用时静默降级为会话内存（A20）；
 *          任何变更立即持久化（A17/A18）；重置清除全部 n5app.* 键（A19）。
 * ========================================================== */
(function () {
  'use strict';

  var KEYS = {
    learned: 'n5app.learnedWords',
    quiz: 'n5app.quizHistory',
    wrong: 'n5app.wrongWords',
    wrongG: 'n5app.wrongGrammar',
    cards: 'n5app.reviewCards',
    grad: 'n5app.reviewGraduated',
    settings: 'n5app.settings',
    readDone: 'n5app.readDone',
    version: 'n5app.version'
  };
  var MAX_HISTORY = 20;
  var DEFAULT_SETTINGS = { count: 10, scope: 'all', timer: 0 };

  var store = {
    learned: [], quiz: [], wrong: [], wrongG: [], cards: {}, grad: 0,
    settings: Object.assign({}, DEFAULT_SETTINGS), readDone: []
  };
  var degraded = false; // localStorage 不可用时为 true（仅内存）
  var listeners = [];

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  /* 测验设置清洗（v3.0·B2，spec §4.5）：键缺失/非法值回默认 */
  function sanitizeSettings(s) {
    var out = { count: DEFAULT_SETTINGS.count, scope: DEFAULT_SETTINGS.scope, timer: DEFAULT_SETTINGS.timer };
    if (!s || typeof s !== 'object') return out;
    var c = +s.count;
    if (c === 0 || c === 5 || c === 10 || c === 15 || c === 20) out.count = c;
    if (s.scope === 'wrong') out.scope = 'wrong';
    var t = +s.timer;
    if (t === 0 || t === 20 || t === 30 || t === 45) out.timer = t;
    return out;
  }
  function nowDayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function strArr(a) {
    return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : null;
  }

  function saveAll() {
    try {
      if (degraded) return; // 内存模式无需写
      window.localStorage.setItem(KEYS.learned, JSON.stringify(store.learned));
      window.localStorage.setItem(KEYS.quiz, JSON.stringify(store.quiz));
      window.localStorage.setItem(KEYS.wrong, JSON.stringify(store.wrong));
      window.localStorage.setItem(KEYS.wrongG, JSON.stringify(store.wrongG));
      window.localStorage.setItem(KEYS.cards, JSON.stringify(store.cards));
      window.localStorage.setItem(KEYS.grad, String(store.grad));
      window.localStorage.setItem(KEYS.settings, JSON.stringify(store.settings));
      window.localStorage.setItem(KEYS.readDone, JSON.stringify(store.readDone));
      window.localStorage.setItem(KEYS.version, '1');
    } catch (e) {
      degraded = true; // 降级：仅本会话内存
    }
  }

  function load() {
    store.learned = readJSON(KEYS.learned, []);
    store.quiz = readJSON(KEYS.quiz, []);
    store.wrong = readJSON(KEYS.wrong, []);
    store.wrongG = readJSON(KEYS.wrongG, []);
    store.learned = Array.isArray(store.learned) ? store.learned : [];
    store.quiz = Array.isArray(store.quiz) ? store.quiz : [];
    store.wrong = Array.isArray(store.wrong) ? store.wrong : [];
    store.wrongG = Array.isArray(store.wrongG) ? store.wrongG : [];
    store.cards = readJSON(KEYS.cards, {});
    store.grad = readJSON(KEYS.grad, 0);
    store.settings = sanitizeSettings(readJSON(KEYS.settings, {}));
    store.readDone = readJSON(KEYS.readDone, []);
    if (typeof store.cards !== 'object' || store.cards === null || Array.isArray(store.cards)) store.cards = {};
    if (typeof store.grad !== 'number' || isNaN(store.grad)) store.grad = 0;
    if (!Array.isArray(store.readDone)) store.readDone = [];
  }

  function emit() {
    var snapshot = {
      learned: store.learned.slice(),
      quiz: store.quiz.slice(),
      wrong: store.wrong.slice(),
      wrongG: store.wrongG.slice(),
      cards: Object.assign({}, store.cards),
      grad: store.grad,
      settings: Object.assign({}, store.settings),
      readDone: store.readDone.slice()
    };
    listeners.forEach(function (fn) { try { fn(snapshot); } catch (e) {} });
  }

  function inArr(arr, id) { return arr.indexOf(id) >= 0; }

  var api = {
    degraded: function () { return degraded; },

    /* —— 已学单词 —— */
    learnedList: function () { return store.learned.slice(); },
    hasLearned: function (id) { return inArr(store.learned, id); },
    learnedCount: function () { return store.learned.length; },
    addLearned: function (id) {
      if (!inArr(store.learned, id)) { store.learned.push(id); saveAll(); emit(); }
    },
    removeLearned: function (id) {
      var i = store.learned.indexOf(id);
      if (i >= 0) { store.learned.splice(i, 1); saveAll(); emit(); }
    },
    toggleLearned: function (id) {
      if (api.hasLearned(id)) api.removeLearned(id); else api.addLearned(id);
    },

    /* —— 测验历史 —— */
    quizHistory: function () { return store.quiz.slice(); },
    quizCount: function () { return store.quiz.length; },
    lastQuiz: function () { return store.quiz.length ? store.quiz[store.quiz.length - 1] : null; },
    addQuizRecord: function (rec) {
      store.quiz.push(rec);
      if (store.quiz.length > MAX_HISTORY) store.quiz = store.quiz.slice(-MAX_HISTORY);
      saveAll(); emit();
    },

    /* —— 错题清单 —— */
    wrongList: function () { return store.wrong.slice(); },
    wrongCount: function () { return store.wrong.length; },
    hasWrong: function (id) { return inArr(store.wrong, id); },
    addWrong: function (id) {
      if (!inArr(store.wrong, id)) { store.wrong.push(id); saveAll(); emit(); }
    },
    removeWrong: function (id) {
      var i = store.wrong.indexOf(id);
      if (i >= 0) { store.wrong.splice(i, 1); saveAll(); emit(); }
    },

    /* —— 语法错题清单（v1.7） —— */
    grammarWrongList: function () { return store.wrongG.slice(); },
    grammarWrongCount: function () { return store.wrongG.length; },
    hasGrammarWrong: function (id) { return inArr(store.wrongG, id); },
    addGrammarWrong: function (id) {
      if (!inArr(store.wrongG, id)) { store.wrongG.push(id); saveAll(); emit(); }
    },
    removeGrammarWrong: function (id) {
      var i = store.wrongG.indexOf(id);
      if (i >= 0) { store.wrongG.splice(i, 1); saveAll(); emit(); }
    },

    /* —— 复习卡（v3.0·B1，spec §3.9） —— */
    reviewGet: function (id) { return store.cards[id] || null; },
    reviewAll: function () { return Object.assign({}, store.cards); },
    reviewSet: function (id, rec) { store.cards[id] = rec; saveAll(); emit(); },
    reviewRemove: function (id) {
      if (store.cards[id]) { delete store.cards[id]; saveAll(); emit(); }
    },
    reviewGrad: function () { return store.grad; },
    reviewGradAdd: function (n) { store.grad += n; saveAll(); emit(); },

    /* —— 测验设置（v3.0·B2，spec §3.5） —— */
    settingsGet: function () { return Object.assign({}, store.settings); },
    settingsSet: function (patch) {
      store.settings = sanitizeSettings(Object.assign({}, store.settings, patch || {}));
      saveAll(); emit();
    },

    /* —— 备份导出/导入（v3.0·B5，spec §3.12/§4.8） —— */
    backup: function () {
      return {
        learned: store.learned.slice(),
        quiz: store.quiz.map(function (r) {
          return {
            type: r.type, date: r.date, total: r.total, correct: r.correct,
            wrongIds: r.wrongIds.slice(),
            seen: r.seen ? r.seen.slice() : undefined
          };
        }),
        wrong: store.wrong.slice(),
        wrongG: store.wrongG.slice(),
        readDone: store.readDone.slice(),
        cards: Object.assign({}, store.cards),
        grad: store.grad,
        settings: Object.assign({}, store.settings)
      };
    },
    /* 整体恢复：必需键缺失/类型非法返回 false；卡片与设置做键级清洗 */
    restore: function (b) {
      if (!b || typeof b !== 'object') return false;
      var learned = strArr(b.learned);
      var wrong = strArr(b.wrong);
      var wrongG = strArr(b.wrongG);
      var readDone = strArr(b.readDone);
      if (!learned || !wrong || !wrongG || !readDone) return false;
      if (!Array.isArray(b.quiz)) return false;

      var quiz = b.quiz.filter(function (r) {
        return r && (r.type === 'words' || r.type === 'grammar') &&
          typeof r.date === 'string' && isFinite(+r.total) && isFinite(+r.correct) &&
          Array.isArray(r.wrongIds) && (r.seen === undefined || Array.isArray(r.seen));
      }).map(function (r) {
        return {
          type: r.type,
          date: String(r.date),
          total: Math.max(0, (+r.total) | 0),
          correct: Math.max(0, (+r.correct) | 0),
          wrongIds: r.wrongIds.filter(function (x) { return typeof x === 'string'; }),
          seen: r.seen ? r.seen.filter(function (x) { return typeof x === 'string'; }) : undefined
        };
      }).slice(-MAX_HISTORY);

      var cards = {};
      if (b.cards && typeof b.cards === 'object' && !Array.isArray(b.cards)) {
        Object.keys(b.cards).forEach(function (id) {
          var c = b.cards[id];
          if (!c || typeof c !== 'object') return;
          var st = Math.min(5, Math.max(0, (+c.st) | 0));
          var due = (typeof c.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.due)) ? c.due : nowDayStr();
          var last = (typeof c.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.last)) ? c.last : '';
          cards[id] = { k: c.k === 'g' ? 'g' : 'w', st: st, due: due, last: last };
        });
      }
      var grad = (isFinite(+b.grad) && +b.grad >= 0) ? Math.floor(+b.grad) : 0;

      store.learned = learned;
      store.quiz = quiz;
      store.wrong = wrong;
      store.wrongG = wrongG;
      store.readDone = readDone;
      store.cards = cards;
      store.grad = grad;
      store.settings = sanitizeSettings(Object.assign({}, DEFAULT_SETTINGS,
        (b.settings && typeof b.settings === 'object') ? b.settings : {}));
      saveAll();
      emit();
      return true;
    },

    /* —— 阅读已读（v3.0·B3，spec §3.10） —— */
    readDoneList: function () { return store.readDone.slice(); },
    hasReadDone: function (id) { return inArr(store.readDone, id); },
    readDoneCount: function () { return store.readDone.length; },
    addReadDone: function (id) {
      if (!inArr(store.readDone, id)) { store.readDone.push(id); saveAll(); emit(); }
    },
    removeReadDone: function (id) {
      var i = store.readDone.indexOf(id);
      if (i >= 0) { store.readDone.splice(i, 1); saveAll(); emit(); }
    },
    toggleReadDone: function (id) {
      if (api.hasReadDone(id)) api.removeReadDone(id); else api.addReadDone(id);
    },

    /* —— 重置（A19：清除全部 n5app.* 键） —— */
    clearAll: function () {
      store.learned = []; store.quiz = []; store.wrong = []; store.wrongG = [];
      store.cards = {}; store.grad = 0;
      store.settings = Object.assign({}, DEFAULT_SETTINGS);
      store.readDone = [];
      try {
        Object.keys(KEYS).forEach(function (k) { window.localStorage.removeItem(KEYS[k]); });
      } catch (e) { /* 内存模式无需处理 */ }
      saveAll();
      emit();
    },

    onChange: function (fn) { listeners.push(fn); }
  };

  load();
  window.N5Progress = api;
})();
