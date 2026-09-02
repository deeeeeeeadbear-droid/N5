/* ==========================================================
 * N5 日语学习 MVP — 本地进度（localStorage，spec §4.5）
 * 键：
 *   n5app.learnedWords  已学单词 id[]
 *   n5app.quizHistory   测验记录 {date,total,correct,wrongIds[]}[]（保留最近 20 条）
 *   n5app.wrongWords    当前错题清单 id[]
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
    version: 'n5app.version'
  };
  var MAX_HISTORY = 20;

  var store = { learned: [], quiz: [], wrong: [], wrongG: [] };
  var degraded = false; // localStorage 不可用时为 true（仅内存）
  var listeners = [];

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function saveAll() {
    try {
      if (degraded) return; // 内存模式无需写
      window.localStorage.setItem(KEYS.learned, JSON.stringify(store.learned));
      window.localStorage.setItem(KEYS.quiz, JSON.stringify(store.quiz));
      window.localStorage.setItem(KEYS.wrong, JSON.stringify(store.wrong));
      window.localStorage.setItem(KEYS.wrongG, JSON.stringify(store.wrongG));
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
  }

  function emit() {
    var snapshot = {
      learned: store.learned.slice(),
      quiz: store.quiz.slice(),
      wrong: store.wrong.slice(),
      wrongG: store.wrongG.slice()
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

    /* —— 重置（A19：清除全部 n5app.* 键） —— */
    clearAll: function () {
      store.learned = []; store.quiz = []; store.wrong = []; store.wrongG = [];
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
