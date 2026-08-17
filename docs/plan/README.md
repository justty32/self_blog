# self_blog 建置規劃

狀態：`Proposed`
日期：2026-08-17
正式決策：[ADR-0002：採用 Hugo standard、移除 npm 與 production Mermaid](adr/0002-hugo-no-npm.md)
網站：`https://justty32.github.io/self_blog/`

> 本文件只描述方案與執行順序；在審查完成並提交計畫文件前，不建立網站、不複製 workflows、不安裝套件。

## 方案摘要

使用 Hugo `v0.165.0` Standard 的固定 binary，在 build-time 將 Markdown 轉成可直接由 GitHub Pages 提供的普通 HTML。官方 manifest 中 Linux amd64 checksum 為 `5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432`，Windows amd64 checksum 為 `bdd9cc7837a42389067b2d0df7858d5878ceddef21307c2dd27fa10885fbbcf9`；實作時仍須對實際下載檔驗 hash，並在各平台檢查 exact `hugo version`。

本機作者流程正式支援 Windows amd64 與 Linux amd64。兩邊都使用 PowerShell 7 的同一條
`pwsh -NoProfile -File scripts/publish.ps1`，不維護行為可能分歧的第二套 Bash 腳本。CI
仍共用同一套 PowerShell scripts，但由 Ubuntu amd64 跑完整 validation／production／artifact／
budget／Pages path，Windows amd64 只跑作者流程與跨平台語意子集，不重跑效能、部署或完整
站點 smoke；Windows 子集在 disposable Git fixture 使用 `publish.ps1 -TestMode`，不得
commit、push 或寫入網路。腳本不得依賴磁碟機代號、反斜線或大小寫不敏感檔案系統。

正式網站不依賴 npm、Node、package lock、Hugo theme、遠端 module、git submodule 或 client JavaScript；MVP 也不包含 production 流程圖，因為目前的一般 blog 需求不需要 renderer，而不是因為 D2／Graphviz 等原生 binary 技術上不可行。現有 `spikes/mermaid-renderer/` 是前一方案的歷史研究，須在第一個 Hugo 功能前以獨立 cleanup commit 連同其 lockfile 與本機 `node_modules/` 移出工作樹；Git 歷史仍保留證據。訪客只取得 HTML、CSS、favicon，以及文章實際引用的本地技術截圖。文章來源可以保留 Markdown，因為 parser 只在 build-time 使用。

正式內容包括：文章與 draft、Hugo 原生 tags／categories、`/archive/` 的單一月份索引（以 `YYYY-MM` anchors 分組並受 120 KiB／6 requests hard budget 保護）、一般 Markdown 頁面（如 About／Contact）、RSS、sitemap、404、GitHub Pages project-site base `/self_blog/`，以及以 semantic tokens 實作的 CSS theme。文章使用 Hugo 原生 content model；`title`、`description`、`date`、`tags` 必填，`lastmod`、`draft`、`categories` 可選，且省略 `draft` 時沿用 Hugo 預設 `false`。不另造 `publishedAt`、自訂 taxonomy 或 tag slug。圖片來源放在 `media/`，只允許技術截圖；author guide 交付於 `docs/AUTHORING.md`。

## 需求對照

| 需求 | 規劃落點 | 驗收證據 |
|---|---|---|
| 靜態 blog／Pages | Hugo static build、`/self_blog/` | artifact、部署後深層 URL smoke test |
| Markdown 文章 | Hugo 原生 `content/` + `date`／`lastmod`／`draft`／`tags` | build 後只剩 ordinary HTML；draft 不進 artifact |
| 導航 | 原生 tags／categories、`/tags/`、term pages、`/archive/#YYYY-MM` | 每個連結可直接開啟，無瀏覽器端篩選 |
| 一般頁面 | `content/<page>.md` | 只新增 Markdown 即產生頁面 |
| 圖片 | `media/` 的本地技術截圖 | 只發布公開文章引用的檔案；尺寸／大小 gate |
| 外觀 | 自有 CSS、semantic tokens、藍／青綠輕科幻 theme | 無 JS 換膚；響應式與無障礙檢查 |
| 低供應鏈風險 | 固定 Hugo binary、固定 Actions SHA、無 npm | checksum、license inventory、artifact scan |
| workflows | 只導入已授權且 pin 的精簡 snapshot | upstream license、notice、manifest、可回滾證據 |

## 文件地圖

| 文件 | 用途 |
|---|---|
| [architecture.md](architecture.md) | Hugo 結構、內容 contract、路由、圖片、CSS 與輸出限制 |
| [deployment.md](deployment.md) | Pages workflow、`/self_blog/` URL、artifact 與部署驗證 |
| [workflow-import.md](workflow-import.md) | workflows allowlist、snapshot、provenance、更新與回滾 |
| [licensing.md](licensing.md) | Hugo／Actions／workflows／素材的授權邊界與 gate |
| [milestones.md](milestones.md) | 里程碑、執行證據與風險 |
| [review-checklist.md](review-checklist.md) | 可簽核的需求、供應鏈、外部 gate 與 commit 規則 |
| [OPUS_ADVICE.md](OPUS_ADVICE.md) | 審查理由與裁決記錄；**接手實作先讀第六節 F 段**，規格仍以本目錄正式文件為準 |
| [OPUS_ADVICE_REPLY.md](OPUS_ADVICE_REPLY.md) | 對 R2 審查的回覆與 disposition record |
| [adr/0002-hugo-no-npm.md](adr/0002-hugo-no-npm.md) | 轉向 Hugo 的權威決策；[ADR-0001](adr/0001-mermaid-profile-b-evidence.md) 僅為歷史 spike |
| [adr/0003-month-archive.md](adr/0003-month-archive.md) | 以單一 archive 頁與月份 anchors 滿足按月尋找，並定義成長 budget |

## 執行順序

```text
1. 審查本計畫，確認 URL、license profile 與 Hugo checksum
2. 將計畫／ADR／審查記錄先提交，取得 plan commit SHA
3. 獨立 cleanup commit：移除歷史 Mermaid spike／lockfile／node_modules，建立三項 output ignore
4. 寫好並獨立提交 site gate（checksum、template sentinel、content／image、base、archive budget、publish isolation、0-JS）；workflows gate 可維持 Deferred
5. gate 先以負向 fixture 證明會擋錯，再由下一個 commit 建立 Hugo 最小垂直切片使 gate 轉綠
6. 分別加入原生 content model、tags／categories、月份 anchors、一般頁面、圖片與 CSS theme
7. 完成 Pages、效能／無障礙、授權 inventory 與 author guide，部署驗證
```

第 4 步的 gate 必須先於它保護的功能。禁止在同一 commit 同時修改 gate，及修改後會讓該 gate 失敗的程式；若要放寬規則，必須另立並接受 ADR。workflows upstream 未補足 scope 足夠的 MIT LICENSE 並產生可 pin 的新 commit 前，只能停留在規劃／其他不依賴該 snapshot 的工作，不得導入 workflows。

### M0 前置決定

- `custom domain`：無；正式 base 是 `/self_blog/`。
- license profile：自有內容採 MIT；第三方保留原授權，採明列 permissive allowlist。
- 流程圖：因 MVP 沒有實際需求而不在 production scope；不宣稱 D2／Graphviz 不可行，未來有需求時另立 enhancement ADR。ADR-0001 的 renderer 與 npm 證據不構成正式依賴。
- 所有 client JavaScript、remote resource、theme/module 依賴均為非目標。

各階段的命令與 evidence matrix 見 [milestones.md](milestones.md)；正式實作開始前必先完成 [review-checklist.md](review-checklist.md) 的 sign-off 條件。

### 一鍵發布流程

作者只需準備 Markdown 與 `media/` 中被文章引用的截圖，執行 `pwsh -NoProfile -File scripts/publish.ps1`。只有一個變更的 content unit 時腳本會自動選取；有多個時必須以 `-Content` 指定本次文章／頁面。起始 index 必須乾淨；temporary index 會產生 `HEAD` 加本次 content unit 與 owned media 的 candidate tree，驗證只對該 tree 的隔離 snapshot 執行，不讀取其他未提交變更。集合外的 unstaged／untracked 路徑會明列為本次排除但不阻擋。命令通過 front matter、圖片、draft／路由與 artifact gate 後，只 stage 該 content unit 與其專屬 `media/<post>/` 下的變更（包含刪除；留下的檔案必須都有引用），並要求 real index／commit tree ID 都等於已驗證 candidate tree。作者確認後才 scoped push。GitHub Actions 重新以固定 Hugo build／verify 並部署 Pages。Hugo 的 `public/` 是 build output，必須被 `.gitignore` 排除，永不進 git、commit 或 push。
