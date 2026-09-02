# 日本語 N5 — 学习手帐（正式版 v2.0）

纯前端静态的 **JLPT N5 日语学习应用**：单词（800 词全量词库）、语法（74 条 N5 考点分组讲解）、阅读（40 篇全文注音短文，词库入文覆盖 ~80%）、自测（单词双向题 + 语法题库 60 题，覆盖全部句型/活用考点）、本地进度记录。黑白杂志编辑风，面向 Windows PC 16:9 桌面，移动端较好兼容。

> 规格文档：`spec/mvp.md`（Spec 驱动开发，版本 v2.0）；工作规范：`AGENTS.md`。

## 运行

无需安装与构建，浏览器直接打开即可：

- 本地：双击 `index.html`（`file://` 可用，数据经 `<script>` 内联加载）
- 或任意静态托管：`python -m http.server` / VS Code Live Server 等

数据存储于浏览器 `localStorage`（键前缀 `n5app.`），无任何后端。

## 目录结构

```
index.html              应用入口（报头 + 导航：单词/语法/阅读/测验/进度）
css/style.css           全局样式（桌面优先，窄窗 ≤1225px 自动降级）
js/app.js               路由与模块初始化
js/words.js             M2 单词模块    js/grammar.js    M3 语法模块
js/reading.js           M4 阅读模块    js/quiz.js       M5 测验与进度
js/annotate.js          注音标记 → <ruby> 渲染
js/progress.js          localStorage 进度（已学/测验历史/错词/语法错题）
data/words.js           词库 800 词      data/grammar.js  语法 74 条（助词 22/活用 16/句型 36）
data/reading.js         阅读 40 篇        data/quiz-grammar.js 语法题库 60 题（gid 全覆盖）
scripts/validate-data.js 数据完整性校验（提交前必跑；规模阈值 800/70/10/60 + 题型覆盖校验）
scripts/audit-app.js     应用静态审计（元素引用/资源/结构）
spec/mvp.md             v2.0 规格（功能 + 验收 A1–A28）
design/                 风格评审稿（03 为最终视觉基准，PC 16:9 桌面版）
```

## 验证与提交前检查（见 AGENTS.md）

```bash
node scripts/validate-data.js   # 数据校验：字段/注音覆盖/标记配对/规模下限（800词/70语法/10篇/60题）/词条查重/题库全覆盖
node scripts/audit-app.js       # 静态审计：资源引用/元素 id/导航视图/脚本顺序
# 另建议浏览器人工走查 spec/mvp.md §6 的 A1–A28 清单
```

## 数据扩充指引（正式版数据填充）

- **词库**：向 `data/words.js` 的数组追加条目（id 递增；`example.jp` 汉字须带注音标记 `漢字{よみ}`，如 `日本語{にほんご}`）。
- **语法**：向 `data/grammar.js` 追加条目（`examples[].jp` 同样须带注音）。
- **阅读**：向 `data/reading.js` 追加篇目（正文每个汉字串须紧跟 `{注音}`；生词用 `*語{よみ}*` 标记并按出现顺序补充 `gloss` 数组）。
- **语法题（v2.0 已达 60 题，可继续扩充）**：向 `data/quiz-grammar.js` 追加条目（每题题干含且仅含一个 `＿`，4 个不重复选项 + `answer` 下标 + `explain` 解析）；新增题若对应「句型/动词活用」考点请填 `gid` 字段（如 `gid: "g0047"`），校验器将保证全部 52 条句型/活用均有题目覆盖。
- 追加后运行 `node scripts/validate-data.js` 直至零错误；界面代码无需改动。

## 部署到网络（演练指引）

本应用是纯静态站点，任意静态托管均可：

1. **GitHub Pages**：把本仓库推送到 GitHub → Settings → Pages → Source 选 `Deploy from a branch` / `main` + root → 保存，几分钟后即通过 `https://<用户名>.github.io/<仓库>/` 访问。
2. **Netlify / Vercel / Cloudflare Pages**：直接拖入或连接仓库，构建命令留空、发布目录填根目录（或 `.`）。
3. 本地服务器验证（可选）：`npx serve .` 后访问提示的地址。

部署后注意：学习进度存于各浏览器 localStorage，换设备/换浏览器不互通（见规格 §1.3）。

> 当前线上版本：<https://deeeeeeeadbear-droid.github.io/N5/>（GitHub Pages 已启用，推送 `main` 自动重新部署）。
