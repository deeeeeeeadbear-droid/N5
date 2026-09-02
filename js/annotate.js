/* ==========================================================
 * N5 日语学习 MVP — 注音标记工具（共享）
 * 标记语法见 spec/mvp.md §4.3（v1.4/v1.5）：
 *   汉字串{假名注音}，如 日本語{にほんご}、行{い}きます
 *  - toHTML(text)   → 转 <ruby>汉字<rt>注音</rt></ruby> HTML
 *  - strip(text)    → 去除标记返回纯文本（检索用）
 * ========================================================== */
(function () {
  'use strict';

  var KANJI = /[\u4e00-\u9fff]/;
  var out = {};

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 注音文本 → 安全 HTML（<ruby>） */
  function toHTML(text) {
    var s = String(text);
    var html = '';
    var i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (KANJI.test(ch)) {
        // 连续汉字串
        var j = i;
        while (j < s.length && KANJI.test(s[j])) j++;
        var kanjiRun = s.slice(i, j);
        // 其后须紧跟 {注音}（数据经校验；容错处理缺失情况）
        if (s[j] === '{') {
          var close = s.indexOf('}', j + 1);
          if (close > 0) {
            var yomi = s.slice(j + 1, close);
            html += '<ruby>' + esc(kanjiRun) + '<rt>' + esc(yomi) + '</rt></ruby>';
            i = close + 1;
            continue;
          }
        }
        html += esc(kanjiRun);
        i = j;
        continue;
      }
      if (ch === '{') { // 容错：孤立注音组按原文输出
        var e2 = s.indexOf('}', i + 1);
        html += esc(e2 > 0 ? s.slice(i, e2 + 1) : ch);
        i = e2 > 0 ? e2 + 1 : i + 1;
        continue;
      }
      html += esc(ch);
      i++;
    }
    return html;
  }

  /** 去除注音标记 → 纯文本（如 日本語{にほんご} → 日本語） */
  function strip(text) {
    return String(text).replace(/\{[^}]*\}/g, '');
  }

  out.toHTML = toHTML;
  out.strip = strip;
  window.N5Annot = out;
})();
