# GitHub Pages 與 URL／發布規劃

← [規劃入口](README.md)｜[架構](architecture.md)｜[里程碑](milestones.md)

## 1. 正式輸出與 project-site base

正式網址是：

```text
https://justty32.github.io/self_blog/
```

正式建置使用 Hugo **v0.165.0 standard edition**。版本、作業系統與 SHA-256
checksum 必須固定在 CI 設定；不得使用浮動 `latest`、第三方 Hugo action、Hugo
theme 或遠端 Hugo module。專案不包含 `package.json`、npm、Node、Mermaid 或
任何 client-side JavaScript。

`hugo.toml` 的 URL 基線：

```toml
baseURL = 'https://justty32.github.io/self_blog/'
publishDir = 'public'
locale = 'zh-Hant-TW'
timeZone = 'Asia/Taipei'
relativeURLs = false
canonifyURLs = false
```

`baseURL` 必須包含尾斜線。模板使用 `.RelPermalink`、`.Permalink`、`relURL`
與 `absURL`；不得散落手寫 `/self_blog/`，也不得產生未帶 project base 的
root-relative URL。`relativeURLs` 保持關閉，避免 Hugo 的粗略 post-processing
改寫文章內容中的 URL。

## 2. 來源結構與 URL contract

文章使用 leaf bundle，並以 Hugo 原生 `:contentbasename` 產生 URL；一般頁面直接放在
content root，沿用 Hugo 的檔名路由。兩者都不要求 `slug` frontmatter，也不自訂 slug
normalization：

```text
content/
  posts/
    2026/
      first-post/
        index.md        -> /self_blog/posts/first-post/
  about.md              -> /self_blog/about/
  contact.md            -> /self_blog/contact/
media/
  first-post/
    terminal.webp
layouts/
static/
```

```toml
[permalinks.page]
posts = '/posts/:contentbasename/'
```

預定輸出：

```text
/self_blog/
/self_blog/posts/
/self_blog/posts/<contentbasename>/
/self_blog/<contentbasename>/
/self_blog/archive/
/self_blog/tags/
/self_blog/tags/<term>/
/self_blog/categories/              # 至少一篇公開文章使用 categories 時
/self_blog/categories/<term>/       # 同上
/self_blog/images/<post>/<file>
/self_blog/index.xml
/self_blog/sitemap.xml
/self_blog/404.html
```

月份只有 `/archive/` 內的 `YYYY-MM` 分組與 anchor；不建立月份 frontmatter、月份
taxonomy 或 `/archive/YYYY/MM/` 動態頁。

## 3. Native content contract

文章只使用 Hugo 原生欄位：

```yaml
---
title: 第一篇文章
description: 可用於列表與 head 的摘要
date: "2026-08-17"
lastmod: "2026-08-18"
draft: false
tags:
  - hugo
categories:
  - tooling
---
```

`title`、`description`、`date`、`tags` 是文章必填；`draft`、`lastmod` 與
`categories` 可省略，`draft` 省略時採 Hugo 原生預設 `false`。頁面至少需要
`title` 與 `description`；`draft` 同樣可省略並預設 `false`。若欄位存在，
validation 仍檢查 `draft` 是 boolean。不新增 `publishedAt`、`updatedAt`、`month`
或自訂 taxonomy 欄位。Hugo template validation 用 `errorf` 檢查必要欄位、原生
日期零值、`lastmod >= date`、tags/categories 的陣列與非空字串；不在 PowerShell
重寫 YAML parser。

`date` 的解析與排序交給 Hugo；作者指南要求使用 `YYYY-MM-DD`。若未來需要驗證
原始 YAML 的引號或字面格式，另立獨立 gate，不在模板中複製 Hugo 日期解析器。

不另寫 taxonomy 設定；直接沿用 Hugo 預設的 `tags` 與 `categories`。不對 term 做
自訂 lower-case、Unicode normalization、percent-encoding 或別名
改寫；路徑 collision 由 Hugo 的 `--printPathWarnings --panicOnWarning` 擋下。

## 4. `media/` local mount 與圖片 gate

`media/` 是 repo 頂層的本地來源，不是 `static/`。Hugo module mount 將它掛到
global assets 的 `images/` 位置；這是 local mount，不是遠端 module：

```toml
[[module.mounts]]
source = 'assets'
target = 'assets'
[[module.mounts]]
source = 'content'
target = 'content'
[[module.mounts]]
source = 'layouts'
target = 'layouts'
[[module.mounts]]
source = 'static'
target = 'static'
[[module.mounts]]
source = 'media'
target = 'assets/images'
```

文章使用本地 logical path，例如：

```markdown
![驗證命令的終端機輸出](images/first-post/terminal.webp)
```

自訂 `layouts/_default/_markup/render-image.html` 只接受 local resource：

- `http:`, `https:`, `//`, root-relative、`..`、query 與 fragment destination
  直接 `errorf`；一般外部 `<a href>` 不受此規則限制。
- 以 `resources.Get` 取得 mount 後的 resource；不存在即失敗。
- `.PlainText` 必須非空。
- 只接受 `.png`、`.jpg`、`.jpeg` 或 `.webp`；`reflect.IsImageResourceWithMeta` 必須為真，並成功取得正整數
  `.Width`、`.Height`，否則以 `errorf` 讓 build 失敗。
- PowerShell 檔案 gate 以來源檔實際 byte length 檢查不得超過 200 KiB；Hugo
  validation partial 檢查最長邊不得超過 1600px。
- 呼叫 `.RelPermalink` 時只發布真正被文章引用的 resource，輸出路徑是
  `/images/<post>/<file>`，並附 `loading="lazy"`、`decoding="async"`。

validation build 另掃描所有 mounted image resource，因此孤兒檔也會接受尺寸與
大小檢查；production artifact 則必須證明 `public/images/` 與生成 HTML 的圖片
引用集合完全相等。`media/` 本身、draft-only 圖片與未引用圖不得進 `public/`。

## 5. Build modes 與單一品質入口

`public/` 永遠是可刪除、可重建的 ignored output，不得提交 Git。兩種 build 都
指定明確 destination，且只在 repo 內的已知輸出目錄使用 `--cleanDestinationDir`：

```powershell
# 驗證全部內容，包括 draft、future、expired
hugo --environment validation --buildDrafts --buildFuture --buildExpired `
  --cleanDestinationDir --destination .hugo-validation `
  --panicOnWarning --printPathWarnings

# 生產 artifact；draft 不會輸出
hugo --environment production --cleanDestinationDir --destination public `
  --panicOnWarning --printPathWarnings

pwsh -NoProfile -File scripts/verify-built-site.ps1 -Dist public
```

`verify-built-site.ps1` 必須是無第三方套件的 PowerShell gate，檢查：

- Hugo output 只有 HTML、CSS、圖片、RSS、sitemap、favicon 等必要檔案。
- 不存在 `.js`、`.mjs`、`<script>`、inline event handler、`javascript:` URL、
  iframe、embed 或自動載入的第三方資源。
- 第三方普通 `<a href>` 可存在，但 stylesheet、image、font、media、preload、
  CSS `url()` 等自動載入 URL 必須是本站或相對 URL。
- 所有 `<img>` 有非空 `alt`、正整數 `width` 與 `height`；輸出圖片大小及尺寸
  合乎 gate。
- draft 的標題、basename、獨特文字、圖片、tag/category、RSS item 與 sitemap
  URL 都不出現在 production output。
- HTML 內的 internal URL、canonical、RSS、sitemap 都正確包含一次
  `/self_blog/`；沒有意外的 `/posts/...` root URL 或雙重 base。每個 same-site URL
  還必須解析到實際 artifact，含 fragment 時也要有對應 `id`。
- `public/` 不含 Markdown、`media/`、`content/`、`docs/`、workflow、Hugo
  binary、module cache 或 source map。

## 6. RSS、sitemap、404 與 archive

只為 home 產生 RSS：

```toml
[outputs]
home = ['HTML', 'RSS']
section = ['HTML']
taxonomy = ['HTML']
term = ['HTML']

[services.rss]
limit = -1
```

`layouts/home.rss.xml` 只 range `Section == "posts"` 且 `Draft == false` 的
公開文章，輸出 `public/index.xml`。About、Contact、tag、category 不得進首頁
feed。production 必須產生 Hugo 內建 `public/sitemap.xml`，並產生
`layouts/404.html` 對應的 `public/404.html`。

`/archive/` template 對 production posts 使用 Hugo 原生 `GroupByDate "2006-01"`；
不讀取或建立月份欄位。PowerShell gate 以兩個以上月份 fixture 驗證每月只出現
一次、文章歸組正確、draft 不出現。

## 7. GitHub Pages Actions

workflow 只使用 GitHub 官方 Actions，且實作時填入完整 40 位 commit SHA、release
名稱與來源註解；禁止浮動 tag。允許的官方 action 僅限必要的 checkout、Pages
metadata、artifact upload 與 deploy：

- `actions/checkout`
- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

Hugo binary 從官方 release 取得並驗證預先記錄的 v0.165.0 standard SHA-256；不
使用第三方 Hugo installer。workflow 不執行 npm 或下載遠端 theme/module。

觸發與權限：

- pull request：checkout、Hugo version/checksum、validation build、production
  build、artifact gate；不部署。
- push `main`：同樣驗證後 upload artifact，再由獨立 deploy job 部署。
- `workflow_dispatch`：非 main 只驗證；只有 main 可 upload/deploy。
- build job 只有 `contents: read` 與 Pages metadata 所需權限；deploy job 才有
  `pages: write`、`id-token: write`。
- `github-pages` environment 與 production concurrency 固定在 workflow；不使用
  PAT、不自動修改 repository Pages 設定。

upload 的 path 必須是 `public/` 的內容本身，不是包著 `public/` 的父目錄。部署後
至少檢查首頁、文章深層頁、tag、archive、RSS、sitemap、CSS、圖片與不存在網址。

## 8. 單一安全發布指令

MVP 的本機支援矩陣是 Windows amd64 與 Linux amd64，兩者都需 Git、PowerShell 7 與
經 checksum 驗證的 Hugo v0.165.0 standard。PowerShell 腳本必須使用跨平台 path API，
不得呼叫 Windows registry、`cmd.exe` 或假設大小寫不敏感；Ubuntu／Windows CI matrix
執行相同 fixture。作者在兩個平台都只需執行：

```powershell
pwsh -NoProfile -File scripts/publish.ps1
```

此指令必須：

1. 確認 repo root、預期 remote、非 detached HEAD，以及 Hugo 正是 v0.165.0。
2. 若只有一個變更的 article/page content unit，自動選取；若有多個，要求作者以
   `-Content <path>` 明確指定，不猜測。文章以 leaf directory 名稱擁有對應的
   `media/<post>/`；本次 media 集合是該目錄下所有變更（包含刪除），且留下的檔案都須被引用。
3. 拒絕已 staged 或 unstaged 的任何選取集合外變更，也拒絕被 Git tracked 的 `public/`。
4. 在受控的暫存 validation destination 執行含 draft 的 validation build。
5. 在明確的 repo `public/` 目錄執行 production build 與完整 artifact gate。
6. 只對選定 content unit 與上述 owned media 變更執行 `git add -- <exact paths>`，
   並再次確認 staged path 與 allowlist 完全相等。
7. 沒有可提交內容、工作樹在驗證期間發生異動、remote/upstream 不符或任一步驟
   失敗時停止，不 commit、不 push。
8. 驗證全綠後建立內容 commit，使用普通 `git push`；禁止 force push、
   `--no-verify` 或 `git add -A`。

網站程式、layout、workflow 或 policy 的修改必須先以獨立 commit 合併；發布指令
只負責已審核程式上的指定 content unit 與其 media 變更。push 後由 Actions 重新 build
並部署，不由作者提交 `public/`。

## 9. 手動 Pages 設定

管理者一次性完成：

1. Repository Settings → Pages → Source 選 GitHub Actions。
2. `github-pages` environment 的 deployment policy 只允許 `main`。

不以高權限 PAT 讓 workflow 自動啟用 Pages。這兩項若尚未完成，記錄在交接文件，
不阻止 Hugo site plan 被接受或本機 site work；但不能宣稱已上線。既有 workflows
snapshot 的授權／導入另列為 Deferred workstream，不作為 Hugo site implementation
的前置條件。

## 參考

- [Hugo URL management](https://gohugo.io/content-management/urls/)
- [Hugo page resources](https://gohugo.io/content-management/page-resources/)
- [Hugo build options](https://gohugo.io/content-management/build-options/)
- [Hugo image render hooks](https://gohugo.io/render-hooks/images/)
- [Hugo RSS templates](https://gohugo.io/templates/rss/)
- [Hugo sitemap templates](https://gohugo.io/templates/sitemap/)
- [Hugo custom 404](https://gohugo.io/templates/404/)
- [Hugo build command](https://gohugo.io/commands/hugo_build/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-actions)
