/* ==========================================================
 * N5 日语学习 MVP — 本地进度（localStorage）
 * M2：已学单词 learnedWords（键 n5app.learnedWords，spec §4.5）
 * M5 将扩展：quizHistory / wrongWords / version
 * 设计约定：localStorage 不可用时静默降级为会话内存（A20）。
 * ========================================================== */
(function () {
  'use strict';

  var KEY_LEARNED = 'n5app.learnedWords';
  var memory = null; // localStorage 不可用时使用

  var listeners = [];
  var learned = [];

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY_LEARNED);
      learned = raw ? JSON.parse(raw) : [];
    } catch (e) {
      learned = memory || [];
    }
    if (!Array.isArray(learned)) learned = [];
  }

  function save() {
    try {
      window.localStorage.setItem(KEY_LEARNED, JSON.stringify(learned));
      memory = null;
    } catch (e) {
      memory = learned.slice(); // 降级：仅本会话有效
    }
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(learned.slice()); } catch (e) {} });
  }

  var api = {
    list: function () { return learned.slice(); },
    has: function (id) { return learned.indexOf(id) >= 0; },
    count: function () { return learned.length; },
    add: function (id) { if (learned.indexOf(id) < 0) { learned.push(id); save(); emit(); } },
    remove: function (id) {
      var i = learned.indexOf(id);
      if (i >= 0) { learned.splice(i, 1); save(); emit(); }
    },
    toggle: function (id) { if (api.has(id)) api.remove(id); else api.add(id); },
    onChange: function (fn) { listeners.push(fn); }
  };

  load();
  window.N5Progress = api;
})();
