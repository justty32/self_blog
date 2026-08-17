# 里程碑、驗收證據與風險

← [規劃入口](README.md)｜[架構](architecture.md)｜[部署](deployment.md)｜[workflows 導入](workflow-import.md)｜[授權](licensing.md)

本版正式方案改為 Hugo v0.165.0 standard、無 npm、無 Mermaid、無 client JS、無
theme／遠端 module。既有 Astro／Mermaid spike 保留作歷史研究，不是 production
site 依賴；流程圖是因 MVP 沒有實際需求而排除，不代表 D2／Graphviz 等原生 binary
技術上不可行。

原則：gate 先於功能；gate fixture/policy 與使 gate 通過的實作分開 commit；任何
讓既有 gate 失敗的程式修改不得和 gate 修改放在同一 commit。workflows snapshot
的授權／導入若尚未完成，列為 Deferred workstream，不阻止 M1–M3 的 Hugo site work，
也不阻止本計畫被接受；部署只有在 Pages workflow 本身的必要權限與授權檢查通過後
才可宣稱完成。

## M0 — 方案、版本與授權 gate

工作：記錄 Hugo migration 決策、固定 v0.165.0 standard checksum、確認 MIT 邊界、
官方 Actions SHA 政策、無 npm／Mermaid／theme／遠端 module，並處理既有 workflows
授權狀態。

Done when：

- reviewer、日期、plan SHA、Hugo edition/version/checksum、Pages base 與 license
  profile 已記錄。
- `.gitignore` 已包含**全部三個** Hugo 產出目錄：`public/`（production artifact）、
  `resources/`（Hugo resource cache）與 `.hugo-validation/`（validation build destination）。
  漏掉任何一個都會污染 `git status`、排除清單或 staged 集合，見
  [deployment.md](deployment.md#5-build-modes-與單一品質入口)。
- `.gitignore` 必須在**第一次執行 `hugo` 之前**就存在，不是事後補；否則產出目錄會先
  混進工作樹。
- 獨立 cleanup commit 已移除 `spikes/mermaid-renderer/`、其 lockfile 與磁碟上的
  `node_modules/`，並建立上述 `.gitignore`；cleanup 不與 gate 或 Hugo 功能混在同一 commit。
- workflow snapshot 上游若沒有足夠授權，明確記為 Deferred；不複製、不假裝完成，
  但不阻止 Hugo site implementation。
- M0 gate commit 綠燈後，才開始 site implementation commit。

## M1 — Hugo 0-JS 靜態垂直切片

工作：建立 Hugo config、固定 base/permalinks、最小 layout/CSS、首頁、posts list、
單篇文章、About page、404、favicon 與 local build gate。

Done when：

- fresh checkout 只需 Hugo 與 PowerShell，沒有 `package.json` 或 `node_modules`。
- Windows amd64 與 Linux amd64 的作者流程共用同一套 `verify.ps1`／`publish.ps1` contract；
  Ubuntu CI 執行完整 gate，Windows CI 執行作者流程與跨平台語意子集，不重跑效能、部署或
  完整站點 smoke。Windows 子集在 fresh disposable Git fixture 以 `publish.ps1 -TestMode`
  執行到 candidate tree／staging assertion，且 HEAD、remote 與網路均不被修改。
- `hugo version` 為 v0.165.0 standard，production build 產生可直接託管的
  `public/`。
- `/self_blog/`、文章、一般頁面與 `404.html` 都帶正確 base。
- output 沒有 `.js`／`.mjs`、`<script>`、third-party auto-load、source 或
  `public` tracked files。
- M1 只提交實作與已存在的 gate；若需新增 gate，先獨立 commit。

## M2 — Content、media 與搜尋維度

工作：native `date`／`lastmod`／`draft`／`tags`／`categories` validation、頂層
`media/` local mount、image render hook、draft exclusion、native taxonomy、
`/archive/` 的 `GroupByDate "2006-01"` 分組，以及必要的正／負 fixture。

Done when：

- 缺少必填欄位、無 tags、錯誤日期、錯誤日期順序、錯誤 taxonomy 型別會由
  Hugo template `errorf` 或 Hugo build fail；`draft` 省略時遵循 Hugo 原生預設
  `false`，若存在則必須是 boolean。
- 不要求 slug frontmatter、不做自訂 slug normalization、不維護月份欄位。
- local image 缺檔、遠端 hotlink、空 alt、無法取得 dimensions、超過 200 KiB
  或 1600px 都失敗；普通外部 `<a href>` 仍可保留。
- mounted image 只有被引用的檔案進 `public/images/`；orphan、draft image 與
  `media/` 來源目錄不進 artifact。
- production 不含 draft 的 route、內容、taxonomy、archive、image、RSS 或 sitemap
  證據；validation build 則明確含 draft 以驗證它們。
- `/tags/`、`/tags/<term>/` 與 archive 都是純 HTML／anchor；若 fixture 使用
  `categories`，對應 `/categories/`／term pages 亦由 Hugo 原生產生。全部無 client filter。
- 實際 production `/archive/` 的 HTML + CSS + favicon raw artifact bytes
  ≤ 120 KiB、≤ 6 requests、0 JavaScript、0 image request；超標時 fail closed，須依
  [ADR-0003](adr/0003-month-archive.md) 另立演進決策，不能直接放寬 budget。
- budget fixture 證明 120 KiB 恰好通過、120 KiB + 1 byte 失敗，且 HTML preload、CSS
  `@import`／`url()`、image／JavaScript 不會被 request closure 漏算。

## M3 — Feed、artifact 與 Pages workflow

工作：home-only `index.xml` RSS、內建 sitemap、custom 404、完整 PowerShell
artifact gate、官方 Actions full SHA workflow、Pages artifact 與 deployment smoke。

Done when：

- RSS 只包含公開 `posts`，不包含一般頁面、draft、tag 或 category；XML 可解析。
- Ubuntu gate 先以官方 manifest 驗證 Linux amd64 archive SHA-256，再要求 `hugo version`
  同時回報 v0.165.0、linux/amd64、standard；template fixture 為每個使用中的 page kind、
  render hook 與 RSS template 驗證不同 sentinel。
- `public/sitemap.xml`、`public/404.html` 存在且 URL 都帶一次 `/self_blog/`。
- verify 檢查 0 JavaScript、0 third-party auto-load、圖片引用集合、alt/dimension/
  size、source/draft 洩漏、必要檔案與 base path。
- PR 只 verify；main 才 upload/deploy；Actions 使用完整 commit SHA，build 與
  deploy 權限分離，workflow 不執行 npm。
- workflow snapshot 即使 Deferred，M3 的本機 build／artifact gate 仍可完成；
  Pages workflow 的必要權限與官方 Actions gate 另行通過後才宣稱實際部署完成。

## M4 — 作者流程與安全發布

工作：`scripts/publish.ps1`、`.gitignore`、內容／圖片 fixture、作者指南與安全
commit/push 流程。

Done when：

- 一個 `pwsh -NoProfile -File scripts/publish.ps1` 完成版本確認、選定單一 content unit、
  納入其 owned media 變更（含刪除）、用 temporary index 產生 candidate tree、在該 tree 的
  selected snapshot 執行 validation／production build 與 artifact gate、只 stage 精確
  allowlist、commit 與普通 push。
- 起始 index 必須完全乾淨；集合外 unstaged／untracked 變更會明列並排除，不阻止發布。
  real index 與 commit 的 tree ID 都必須等於已驗證 candidate tree ID；`public/` tracked／
  staged、tree mismatch、非預期 remote、驗證失敗或空內容都會停止，且不得 push。
- 負向 fixture 涵蓋無關 dirty config 隔離、untracked owned media、刪除、驗證期間 selected
  mutation、任一 pre-staged path，以及 `-TestMode` 不 commit／push／寫網路。
- `docs/AUTHORING.md` fresh-clone walkthrough 涵蓋新增／預覽／發布 post、native
  frontmatter、local media、About／Contact Markdown 頁、tags/categories、月份
  archive、常見 build error 與發布指令；Windows amd64、Linux amd64 各自列出 Hugo／
  PowerShell 7 prerequisites 與同一條命令，根 README 有入口。
- `public/` 永不提交，Actions 從 commit 重新產生 artifact。

## M5 — 可讀性、效能與最後審查

工作：semantic CSS tokens、藍／青綠與 plain 兩套外觀、light/dark media query、
中文排版、responsive、reduced-motion、byte/request budget、授權與部署最終審查。

Done when：

- 0 client JS、system fonts、0 third-party auto-load 在所有公開頁成立。
- 首頁、純文字文章、含圖片文章及實際 archive 的 byte/request budget 通過；archive
  ≤ 120 KiB／6 requests 且 0 JS／0 image request，圖片仍遵守 200 KiB／1600px gate。
- keyboard focus、中文排版、手機／桌面、light/dark 與 reduced-motion 通過人工
  和自動檢查。
- LICENSE、第三方 notices、Hugo／Actions checksum、workflow 的 Deferred 狀態（若已導入則含 provenance）、
  author guide、正式 base、RSS、sitemap、404 與部署 commit SHA 可供其他人審查。

## 驗收證據格式

每個 milestone 的 PR 說明附 evidence matrix：

| milestone | 主要命令 | 證據 |
|---|---|---|
| M0 | version/checksum/license review | 決策紀錄、checksum、授權與 Deferred workstream 狀態 |
| M1 | `hugo ... --environment production` | version output、route list、0-JS/base report |
| M2 | validation build + negative fixtures | frontmatter/image/draft/taxonomy/archive budget report |
| M3 | production build + `verify-built-site.ps1` + Actions | artifact list、RSS/sitemap/404、URL與run SHA |
| M4 | `publish.ps1` + fresh-clone walkthrough | allowlist、commit/push log、作者指南重現記錄 |
| M5 | performance/accessibility/deployed smoke | budget、a11y、license、正式網址與部署證據 |

報告可作 CI artifact，但不得複製進 `public/`。命令的 exit code、輸出路徑、Hugo
版本與 commit SHA 必須同時保存。

## 主要風險與緩解

| 風險 | 緩解 |
|---|---|
| 忘記 `/self_blog/` project base | config 固定完整 base；每個 HTML、RSS、sitemap 與深層 URL gate 驗證 |
| Hugo binary 或 Actions 漂移 | v0.165.0 standard checksum、官方 Actions 完整 SHA、release 註解 |
| draft 或 orphan media 外洩 | `media` local mount、只由 image render hook publish、production clean build 與 artifact scan |
| 圖片過大或缺 alt/dimensions | render hook `errorf` + PowerShell output gate |
| 月份索引和文章日期不一致 | 只用 Hugo native `.Date` 與 `GroupByDate "2006-01"` |
| 供應鏈帶入 runtime JS | 無 npm、無 theme/module、無 Mermaid；輸出禁止 script 與第三方 auto-load |
| 發布驗證內容與實際 commit 不同，或誤提交其他檔案 | temporary index 產生 candidate tree；real index／commit tree ID 必須相等；其他 unstaged／untracked 明列排除，任一 pre-staged path hard fail |
| workflow snapshot 無授權 | 保留 Deferred 狀態；site work 與 deployment 可完成，但不得複製 snapshot 或宣稱該 workstream 完成 |
| 普通外部連結被誤判 | 只禁止會自動載入的 third-party URL；外部 `<a href>` 明確允許 |
