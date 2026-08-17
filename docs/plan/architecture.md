# 架構與內容規劃

← [規劃入口](README.md)｜[部署](deployment.md)｜[里程碑](milestones.md)

## 1. 技術棧：Hugo 0.165.0 Standard，輸出普通靜態檔

採固定的 **Hugo 0.165.0 Standard** binary。其版本、平台 artifact URL、SHA-256、
下載來源與授權證據都必須寫入 CI 和 `THIRD_PARTY_NOTICES.md`；下載後先驗 checksum
才可執行。正式網站不使用 npm、Node.js、`package.json`、`module.imports`、Hugo theme、
JavaScript framework、CSS framework、CMS 或 Mermaid。已提交的 Mermaid spike 是歷史研究；
依 [ADR-0002](adr/0002-hugo-no-npm.md) 在第一個 Hugo 功能前以獨立 cleanup commit 移除。

Hugo 在 build-time 讀取 Markdown，輸出 `public/` 下的普通 HTML、CSS、圖片、RSS 與
sitemap。訪客不會取得 Markdown、Hugo binary、Go template 或任何 Markdown renderer；
所有頁面 client JavaScript 預算均為 **0 bytes、0 requests**。

「全靜態」是不可退讓的 contract：不使用 server mode、serverless adapter、remote
data source、`module.imports`／遠端 Hugo module 或 client-side router。唯一允許的 module
API 是把本 repo `media/` 映射到 assets 的本機 `module.mounts`；不建立 `go.mod`。
GitHub Pages 只提供 `public/` artifact。

採 Hugo 的理由：一個已驗證的 binary 已涵蓋 Markdown、taxonomy、RSS、sitemap、模板、
資源與靜態輸出；不需要建立 Node dependency tree。Hugo 的內容組織、taxonomy、
render hook 與 image resource 都是既有能力，不以自製 parser 或圖片 decoder 取代。

## 2. 內容、frontmatter 與公開投影

文章使用 leaf bundle，但 bundle 內只放 Markdown：

```text
content/posts/2026/hello-world/
  index.md
```

圖片不在文章 bundle，而在頂層 `media/<post-directory>/`，見 [§4](#4-圖片)。
Hugo 的公開 path key 由 leaf bundle 目錄名取得；`hugo.toml` 的 posts permalink 使用
Hugo 原生 `:contentbasename`，不另設 frontmatter slug。年份資料夾只整理 source；改 leaf directory
名稱才會改公開 URL，需另作 redirect ADR。

每篇文章最小 frontmatter：

```yaml
---
title: 第一篇文章
description: 一句可用於列表、RSS 與 SEO 的摘要
date: "2026-08-17"
lastmod: "2026-08-18" # 可省略
draft: true # 草稿才需要寫；省略時沿用 Hugo 預設 false
tags:
  - hugo
categories: # 可省略；沿用 Hugo 預設 taxonomy
  - notes
---
```

`date` 與可選 `lastmod` 是 Hugo 原生 page metadata；模板、RSS 和 sitemap 一律使用
`.Date` 與 `.Lastmod`，不改名、重映射或自行依 runner 時區重算。

內容規則由共用 Hugo validation partial 在 validation build 中驗證；
`scripts/verify-content.ps1` 只負責啟動 Hugo 與做檔案層檢查，不另外實作 YAML parser：

- `title`、`description`、`date`、`tags` 必填；`tags` 至少一個。`lastmod`、`draft` 與
  `categories` 可省略，且皆沿用 Hugo 原生欄位／taxonomy；省略 `draft` 等同 `false`。
- `date`／`lastmod` 必須被 Hugo 解析為有效日期；`lastmod` 不可早於 `date`。排序和
  archive key 一律取 Hugo `.Date`，顯示採 `zh-Hant`、`Asia/Taipei`，禁止用 CI runner
  時區自行分月。
- source inventory 必須證明每個公開 post 的 Hugo permalink 唯一，並阻止與保留 route
  碰撞；不自訂 slug field、slug regex、日期 alias 或 redirect 規則。
- validation build 明確帶 `--buildDrafts --buildFuture --buildExpired`，使草稿也經過相同
  template validation；production build 固定 `buildDrafts = false`。draft 的內容、route、列表、taxonomy、
  archive、RSS、sitemap 和圖片都不得出現在 `public/`；本機預覽 draft 必須明確帶
  `--buildDrafts`。
- 正式內容拒絕 raw HTML、`<script>`、event-handler attribute、remote image hotlink 和
  預先寫入 `/self_blog/` 的站內 URL。

### 一般 Markdown 頁面

「關於」、「聯絡方式」及日後固定資訊頁不要求作者寫 template。來源是：

```text
content/<page>.md
```

例如 `content/about.md` 依 Hugo 的 root content 預設輸出 `/about/`；不另建 `pages`
section，因此也不會多產生沒有用途的 `/pages/` index。文章 permalink 使用 Hugo 原生
`:contentbasename`，不是自訂 frontmatter slug。Hugo 0.165.0 的拋棄式 fixture 已證明
`:slug` 在沒有 frontmatter slug 時會退回 title，而 `:contentbasename` 才會穩定使用
文章 leaf bundle 名稱。
最小 frontmatter 是 `title`、`description`；可選 `draft` 與 Hugo 原生 `menus.main.weight`
讓頁面加入主導航。這類頁面沒有文章日期或 tags，draft 同樣完全排除 production。

page route 不得與 `posts`、`tags`、`categories`、`archive`、`index.xml`、`sitemap.xml`、
`404.html` 或其他 Hugo output 碰撞。導航由 `.Site.Menus.main` 依 Hugo `weight` 產生；
新增 About／Contact 不需改 component registry。
純靜態站不含 contact form；聯絡頁可使用 `mailto:` 或明確文字連結。若未來接第三方表單，
先立隱私與第三方 request ADR。

## 3. 導航、tags 與月份 archive

所有導航在 build-time 產生，不用前端搜尋或篩選：

- 首頁顯示最新公開文章，依 Hugo `.Date` 新到舊排序；同日使用 `.RelPermalink` 作 deterministic tie-break。
- `/posts/` 是完整文章列表；達到 20 篇後才啟用 Hugo static pagination。
- 沿用 Hugo 預設 `tags` 與 `categories` taxonomy；`/tags/` 列出 tags、篇數與最近更新，
  `/tags/<term>/` 列出該 tag 的公開文章。每個 taxonomy page 都是可直達、可分享的靜態 HTML。
- `/archive/` 使用 Hugo `GroupByDate "2006-01"` 依發布月份分組，顯示月份、篇數與文章；
  每個月份有穩定 `YYYY-MM` anchor。**MVP 不產生 `/archive/YYYY/MM/` 獨立頁面。**
- 文章頁顯示發布日期、可選更新日期與 tags；發布日期連到 `/archive/#YYYY-MM`。
- 文章頁提供上一篇／下一篇；RSS 只收公開文章。

月份路由的決策與成長邊界由 [ADR-0003](adr/0003-month-archive.md) 固定：`/archive/`
超過既定 transfer／request budget 時 build 必須失敗；不得直接放寬數字，而要另立 ADR
在 static pagination 與月份獨立頁之間重新選擇。

所有首頁、文章列表、taxonomy、archive、RSS、sitemap、上一篇／下一篇與頁面導航都透過
同一個 Hugo partial 取得「published posts」投影：僅 section `posts`、由 Hugo 的 production
draft filter 排除草稿、按 `.Date`／`.RelPermalink` 排序。不得在各 template 自己重複 filter
或排序。

所有 template link、stylesheet、RSS、sitemap、canonical 與 Open Graph URL 都使用 Hugo
`.RelPermalink`／`.Permalink` 或單一 URL partial。Markdown 的
`layouts/_markup/render-link.html` 只把 `/posts/...`、`/tags/...`、`/archive/...` 和
已存在 standalone page route 的站內 logical root URL 轉為 base-aware relative URL；`#anchor`、
`mailto:` 與完整協定 URL 不改。作者不得自行寫 `/self_blog/...`。`verify-built-site.ps1` 對所有
輸出 URL 斷言 base `/self_blog/` 恰好出現一次，並解析每個 same-site link／fragment，確認
對應的 artifact 檔案與 anchor 確實存在；防止「base 正確但目標仍是 404」。

tag 與 category 的顯示、normalization 與 URL 全由 Hugo taxonomy 處理；不增加自訂
taxonomy、tag slug field、Unicode normalizer、percent encoder 或平行 route generator。
content gate 只檢查原生 frontmatter 可被 Hugo 成功建置，並把 Hugo 實際輸出的 taxonomy
route 納入 artifact inventory。

`verify-built-site.ps1` 以 source inventory 對照 Hugo 實際 output：每篇公開文章恰有一個
article route、每個 Hugo 實際 term 有 taxonomy page、archive 內每個 `YYYY-MM` group 與文章集合
相等；不檢查或重建 Hugo 的 taxonomy slug。

## 4. 圖片

本站沒有 cover、縮圖、角色圖、裝飾圖或 `og:image`。`miku-cyber` 只是配色風格；圖片只可作
技術截圖（終端輸出、設定畫面、實際結果）。首頁、列表與純文字文章不預留圖位。

### 圖片與文章分開放，但都在本 repo

作者把圖片放在頂層：

```text
media/<post-directory>/<file>.(png|jpg|jpeg|webp)
```

文章只寫乾淨、由 render hook 解讀的 logical resource path：

```markdown
![網站驗證的輸出](images/hello-world/verify-output.webp)
```

`hugo.toml` 以 Hugo 內建 mount 設定把 `media/` 掛到 `assets/images/`。這只是本 repo 的
virtual filesystem mapping：不宣告 `go.mod`、不 import remote module、也不使用 theme。
一旦宣告 `module.mounts` 就會取代 Hugo 的預設 mounts，因此 config 必須明列目前使用的
`assets`、`content`、`layouts`、`static` 與 `media`。MVP 刻意不用 `data`、`i18n`、
`archetypes`；未來啟用任一項時，必須同時補 mount 與 template lookup fixture，避免靜默失效。
圖片因此是 Hugo global resource，而不是 `static/` 的無條件複製品；公開文章的 image
render hook 以 `resources.Get` 找到它、失敗即 `errorf`，並用 `.RelPermalink`、`.Width`、
`.Height` 輸出 `<img>`。只有被公開內容實際引用的圖片會進 `public/images/`。

這個做法同時保留圖文分離、乾淨作者連結與 project-site base，又避免 draft／孤兒圖片被
部署。不得把文章圖片放進 `static/images/`；那會無條件複製而外洩 draft asset。

### Image render hook 與入口 gate

`layouts/_markup/render-image.html` 是唯一圖片輸出點，必須：

- 只接受 `images/<post-directory>/<file>.(png|jpg|jpeg|webp)` 的本 repo logical resource path；`https:`、
  `http:`、data URL、root-relative、`..`、query、fragment 和直接寫 `/self_blog/` 都失敗。
- 驗證目標存在且位於 `media/<post-directory>/`；文章 leaf bundle 目錄與圖片目錄必須相等，
  杜絕跨文誤用。
- 要求非空且有意義的 alt，輸出真實 `width`、`height`、`loading="lazy"`、`decoding="async"`。
- 不產生 srcset 或 responsive variants。首版直接發布已壓好的來源檔；換圖時換檔名，
  不宣告 immutable caching。

`verify-content.ps1` 在 Hugo render 前檢查每張來源圖：只允許 PNG、JPEG 或 WebP，單檔 ≤ 200 KiB，
且沒有未引用的 public-image candidate。Hugo 的 validation partial／render hook 使用既有
image resource 方法讀取尺寸並檢查最長邊 ≤ 1600px，不自製圖片 decoder。
`verify-built-site.ps1` 再雙向檢查：每個 HTML image
有輸出檔，每個 `public/images/` 檔都被公開 HTML 引用；`media/` 本身、draft asset 和 orphan
都不能在 artifact。

站級小檔只放 `static/`，首版只有 `static/favicon.svg`。Hugo artifact 是 `public/`，因此
`public/` 永遠不是 source directory。

## 5. 可替換主題與中文排版

樣式分三層：

1. primitives：色階、間距、字級、圓角、陰影、動畫時長。
2. semantic tokens：背景、表面、正文、次要文字、連結、邊框、焦點等角色。
3. component/prose styles：顏色只能用 semantic tokens，尺寸可用共享 primitives。

首批 theme pack 是預設 `miku-cyber`（深海軍藍、青藍／薄荷綠、低強度網格與光暈）及
`plain`（無裝飾、高可讀性對照）。兩者均為本 repo 純 CSS，沒有 Hugo theme、web font、
角色素材或外部 CDN。

最小 token contract：

```text
--color-bg            --color-surface       --color-text
--color-muted         --color-accent        --color-link
--color-border        --color-code-bg       --focus-ring
--font-body           --font-mono           --measure-prose
--space-*             --radius-*            --shadow-*
--motion-fast         --motion-slow
```

build-time theme 選擇 token pack，不放入文章 frontmatter，不做讀者切換器。每個 pack 都提供
light/dark 值，純 CSS `@media (prefers-color-scheme: dark)` 切換；`<meta name="color-scheme"
content="light dark">` 同步瀏覽器 UI。dark media block 外，component CSS 不得覆寫顏色。

本站以繁體中文為主：`hugo.toml` 設 `locale = "zh-Hant-TW"`（Hugo v0.158.0 起 `languageCode`
已 deprecated，改用 `locale`；單語站不需要另建 `[languages]` 或 `defaultContentLanguage`）；
輸出 `<html lang="zh-Hant-TW">`、RSS `<language>zh-Hant-TW</language>`、
Open Graph `og:locale=zh_TW`。設定寫對不等於輸出正確，gate 必須斷言**實際生成的字串**，
而不是斷言設定檔寫了什麼。正文目標每行 35–45 個全形字，以 `em`／`rem` 設
`--measure-prose`，不用 Latin `ch` 假設；字型堆疊明列 `-apple-system`、`"PingFang TC"`、
`"Microsoft JhengHei"`、`"Noto Sans TC"`、`sans-serif`，但不下載 font。中文段落
`line-height` ≥1.75；code 與長 URL 可 `overflow-wrap: anywhere`，正文不使用
`word-break: break-all`。預設字級至少 16px、長 code block 可水平捲動、鍵盤焦點清楚、
一般文字達 WCAG AA，並尊重 `prefers-reduced-motion`。

## 6. 訪客下載 hard budget

production output 使用三個固定 fixture：典型首頁、一篇約 2,000 字的純文字文章，以及一篇
約 2,000 字、含 code 與一張技術截圖的重量級文章；另外每次 build 都量測實際 production
`/archive/`，使它隨文章增加時仍受 gate 保護。首頁、純文字文章與 archive 沒有圖片 request。

| 項目 | 量測 fixture | MVP hard budget |
|---|---|---|
| client JavaScript | 全部頁面 | 0 bytes、0 request |
| 全站共用 CSS | 全部頁面 | raw artifact bytes ≤ 24 KiB |
| 390px 首頁首屏 | 首頁 | HTML + CSS + favicon ≤ 120 KiB、≤ 8 requests、0 圖片 request |
| 純文字文章首載 | 純文字文章 | HTML + CSS + favicon ≤ 100 KiB |
| 文章頁 total transfer | 重量級文章 | 全部資源合計 ≤ 300 KiB、≤ 10 requests |
| archive 首次載入 | 實際 production `/archive/` | HTML + CSS + favicon ≤ 120 KiB、≤ 6 requests、0 JavaScript、0 圖片 request |
| 單張圖片檔 | 任何頁面 | ≤ 200 KiB、最長邊 ≤ 1600px |
| 第三方 origin request | 全部頁面 | 0 request |

為了讓 Windows／Linux 與不同 host runtime 得到相同結果，budget 不模擬 HTTP header、
gzip 或 Brotli：`1 KiB = 1024 bytes`，`total transfer` 是 HTML 本身加上其 auto-load closure
中每個 canonical local artifact 的 raw byte length，重複 URL 只計一次。closure 從 HTML 的
stylesheet、icon、preload、image、media 等載入點開始，並遞迴解析 CSS `@import`／`url()`；
fragment 不增加 request。頁面 HTML 自己也算一個 request。第三方 auto-load、無法解析的 URL、
JavaScript 及 source map 直接失敗，而不是漏算。

`total transfer` 防止單項上限被組合繞過；任一列失敗即整體失敗，不可互相抵銷。artifact 若
出現 `.js`、`.mjs`、source map、Markdown source、Hugo binary、module cache、workflow/docs、
agent 文件、draft 或未使用 asset，驗證直接失敗。未來任何 client JS 都必須另立 Accepted ADR，
說明必要性、逐頁範圍與 byte budget。

archive 使用上述同一 raw-byte／request closure 口徑。gate fixture 必須證明 120 KiB 恰好通過、
120 KiB + 1 byte 失敗，且 HTML preload、CSS `url()`、image 或 JavaScript 都會正確增加 request
或觸發禁止規則。archive 若超過 hard budget，gate 必須 fail closed；只能依
[ADR-0003](adr/0003-month-archive.md) 的演進規則另立決策，不能把 budget 數字直接調大。

## 7. 預定程式結構與品質入口

```text
assets/
  css/{reset,base,prose,syntax,themes}.css
content/
  _index.md
  archive/_index.md
  <page>.md
  posts/<year>/<slug>/index.md
layouts/
  baseof.html
  home.html
  page.html
  section.html
  taxonomy.html
  term.html
  404.html
  home.rss.xml
  archive/section.html
  posts/{section,page}.html
  _markup/{render-image,render-link}.html
  _partials/{head,header,footer,published-posts,post-card}.html
media/
  <slug>/*.{png,jpg,jpeg,webp} # mount 到 assets/images/，不是靜態輸出來源
scripts/
  verify.ps1
  verify-content.ps1
  verify-built-site.ps1
  verify-performance.ps1
  smoke-site.ps1
  publish.ps1
static/
  favicon.svg
hugo.toml
```

上面的 layout 樹採 **Hugo 0.146 起的新 template 系統**：沒有 `_default/`，render hook 在
`layouts/_markup/`，partial 在 `layouts/_partials/`，page kind 直接以 `home`／`page`／
`section`／`taxonomy`／`term` 命名。舊制的 `layouts/_default/{baseof,list,single}.html` 與
`layouts/partials/` 屬於 v0.146 之前的慣例，**不得與新制混用**——兩套寫法都可能在某些版本
被接受，混著寫的結果是有些模板生效、有些被靜默忽略。

因為套錯位置不會報錯、只會悄悄退回預設模板，第一個 Hugo gate 必須以 exact v0.165.0
最小 fixture，替每個本站會使用的 page kind、兩個 render hook 與 RSS template 放置不同
sentinel，再斷言 artifact 確實包含對應 sentinel；只證明 build 成功或只測 `page.html` 不足以
確認 lookup contract。

Hugo output 固定為 `public/`，而不是 `dist/`。`hugo.toml` 明列 `baseURL =
"https://justty32.github.io/self_blog/"`、`locale = "zh-Hant-TW"`、`timeZone =
"Asia/Taipei"`、`disableKinds`（只停用未採用 kind）、Hugo 預設 tags/categories taxonomy、
`posts` permalink、Mounts 與 production `buildDrafts = false`。
不使用 config cascade 偷改內容 contract。

唯一品質入口是 `pwsh -File scripts/verify.ps1`：完整 profile 依序執行 content gate、
`hugo --minify`、artifact/base/0-JS gate、base-mounted smoke test 和已啟用的 performance gate；
author-flow profile 重用相同 scripts，只執行跨平台作者流程子集。沒有接進這個入口的檢查不算
存在。腳本使用 PowerShell 7 與 Hugo 內建能力，不安裝 npm package 或其他 build dependency。
作者在 Windows amd64 與 Linux amd64 都使用相同的 `publish.ps1` contract；腳本只用跨平台
path API，Git path 一律正規化為 `/`，不得假設磁碟機代號、反斜線或大小寫不敏感。

CI 分工為：Ubuntu amd64 跑完整 checksum、content、production、template sentinel、artifact／
base／link／0-JS／image／archive budget gate 與 Pages path；Windows amd64 只跑 checksum/version、
PowerShell 解析、path normalization、content-unit selection、staging allowlist、圖片路徑及最小
Hugo smoke，不重跑效能、部署或完整站點 smoke。Windows author-flow job 必須在新建的
disposable Git fixture 中以 `publish.ps1 -TestMode` 執行到 candidate tree／staging assertion，
並證明 HEAD 未變、沒有 commit、push 或網路寫入；只 parse script 不算通過。正式 artifact 只由
通過必要 jobs 的 Ubuntu deploy path 產生。作者指南提供兩個作業系統的安裝、預覽與發布步驟。

正式作者流程唯一的發布命令是 `pwsh -NoProfile -File scripts/publish.ps1`；`-Content`
與 `-Message` 可選。只有一個變更的 article/page content unit 時自動選取；多個時拒絕猜測並
要求 `-Content <path>`。文章 content unit 擁有同名 `media/<post-directory>/`；腳本納入該
目錄下所有變更（包含刪除），並要求所有留下的檔案都被該文章引用。一般頁面的 media 集合
為空。開始時 index 必須完全乾淨，避免 partial staging 或選定集合內外的既有 staged state
產生歧義。選定集合以外的 unstaged／untracked path 不阻止發布，但必須明列為「本次排除且
不會提交」。腳本以 temporary Git index 從 `HEAD` 加入本次 content unit 與 owned media，產生
唯一 candidate tree ID；validation 與 production verify 只對由該 tree materialize 的隔離
selected snapshot 執行，不得讀取原工作樹其他未提交變更。

驗證通過後，腳本回到原工作樹，只對精確 allowlist 執行 `git add -- <paths>`，再要求 real
index 的 `git write-tree` ID 與已驗證 candidate tree ID 完全相等；這同時偵測 selected source
在驗證期間被修改、刪除或因 filter 產生不同 index bytes。另拒絕 `public/` 被 tracked／staged、
並只對 staged candidate 執行 `git diff --cached --check`，不讓被排除的 unrelated dirty files
誤阻擋發布。最後顯示 diff，建立普通 commit；commit 後、push 前再要求 commit
tree ID 等於 candidate tree ID，否則停止且不得 push。成功時只做 fast-forward push 到
`origin/main`；不得 force push。GitHub Actions 才是 production build、artifact upload 與
deploy 的唯一位置；`public/` 永遠列入 `.gitignore`，不提交、不推送。

## 8. MVP 與非目標

MVP：首頁、文章列表／靜態分頁、archive index（月份 anchor）、文章頁、tag index、per-tag
page、一般 Markdown 頁面、404、GFM、heading anchors、build-time code highlighting、技術截圖、
RSS、sitemap、canonical 與基本 Open Graph（不含 `og:image`）。

暫不包含：Mermaid／其他流程圖 renderer、CMS、留言、全文搜尋、analytics、多作者、國際化、
文章級主題、讀者帳號、SSR、runtime theme switch、Hugo theme、`module.imports`／遠端 module
與遠端圖片。它們
有實際需求時另寫 ADR。

流程圖是因 MVP 沒有實際需求而排除；不是宣稱 D2／Graphviz 等 pinned native binary
方案不可行。未來若有文章需要圖表，再以 enhancement ADR 比較其版本、checksum、授權、
SVG 安全與維護成本。

## 參考

- [Hugo：Content organization](https://gohugo.io/content-management/organization/)
- [Hugo：Taxonomies](https://gohugo.io/content-management/taxonomies/)
- [Hugo：URL management](https://gohugo.io/content-management/urls/)
- [Hugo：Render hooks](https://gohugo.io/render-hooks/)
- [Hugo：Image processing](https://gohugo.io/content-management/image-processing/)
- [Hugo：GroupByDate](https://gohugo.io/methods/pages/groupbydate/)
- [Hugo：All configuration settings](https://gohugo.io/configuration/all/)
- [Hugo：GitHub Pages](https://gohugo.io/host-and-deploy/host-on-github-pages/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
