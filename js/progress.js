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
 *   n5app.version       数据版本 "1"
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
    version: 'n5app.version'
  };
  var MAX_HISTORY = 20;
  var DEFAULT_SETTINGS = { count: 10, scope: 'all', timer: 0 };

  var store = { learned: [], quiz: [], wrong: [], wrongG: [], cards: {}, grad: 0, settings: Object.assign({}, DEFAULT_SETTINGS) };
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
    if (typeof store.cards !== 'object' || store.cards === null || Array.isArray(store.cards)) store.cards = {};
    if (typeof store.grad !== 'number' || isNaN(store.grad)) store.grad = 0;
  }

  function emit() {
    var snapshot = {
      learned: store.learned.slice(),
      quiz: store.quiz.slice(),
      wrong: store.wrong.slice(),
      wrongG: store.wrongG.slice(),
      cards: Object.assign({}, store.cards),
      grad: store.grad,
      settings: Object.assign({}, store.settings)
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

    /* —— 重置（A19：清除全部 n5app.* 键） —— */
    clearAll: function () {
      store.learned = []; store.quiz = []; store.wrong = []; store.wrongG = [];
      store.cards = {}; store.grad = 0;
      store.settings = Object.assign({}, DEFAULT_SETTINGS);
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
