# 里程碑、驗收證據與風險

← [規劃入口](README.md)｜[架構](architecture.md)｜[部署](deployment.md)｜[workflows 導入](workflow-import.md)｜[授權](licensing.md)

## M0 — 審查與前置 gate

工作：審查整組規劃、確認授權解讀、讓 workflows upstream 明確採 MIT，並確認 MVP 暫不使用 custom domain。

Done when：

- 審查意見已解決；入口狀態改為 `Accepted`，並記錄 reviewer、日期、被審 plan commit SHA、license profile 與 custom-domain 決策。
- workflows 的被 pin commit 本身含完整且 scope 足夠的 MIT 授權，權利／來源範圍經 reviewer 接受。
- 依所選 profile 對支援 `deferRender` 的確切 Astro 版本、Mermaid renderer、預定 Actions 與 dependency tree 做可行性 inventory；不合規先改 ADR，不進 M1/M2。
- 該 inventory 必須真的解析出 lockfile，因此在 repo 外的拋棄式目錄執行，只帶回報告；本 repo 在 M0 結束前仍不新增 `package.json`、lockfile 或 `node_modules`。
- 沒有未決事項會改變框架、URL 或授權邊界。

## M1 — 非侵入式 workflows snapshot

工作：依 [workflow-import.md](workflow-import.md) 的 allowlist，從已授權 commit tree 建立根入口與 `wf/` snapshot，保存完整 notice，並建立 `scripts/verify-workflow-snapshot.mjs`。

Done when：

- 根部 workflow 入口只有 `AGENTS.md`、`CLAUDE.md`，其餘均在 `wf/`。
- `rg -n -F -e '{{' -e '〔模板說明〕' -e '〔佔位〕' -- AGENTS.md CLAUDE.md wf` 回傳 1，代表無命中；回傳 0 是殘留，回傳 ≥2 是檢查故障，兩者都不通過。
- `node scripts/verify-workflow-snapshot.mjs` 回傳 0，證明 manifest/blob/notice 完整、相對 Markdown links 可解析、沒有排除 workflow 的連結或純文字導流，且 `AGENTS → WORKFLOWS → feature-dev/testing/write` 可走通。
- 反向 `AGENTS.md` link 以列舉方式檢查：validator 要求「零個未依深度改寫的連結」，不比對任何預期數量常數（盤點時的 9 個綁在 `7e7d20b`，導入時 pin 的是另一個 commit）。
- 所有操作性文件、scripts、設定與 CI 不含本機 workflows checkout 的絕對路徑；`wf/UPSTREAM.md` 只以 remote URL、完整 SHA 與 manifest 表示來源。
- `wf/LICENSE.workflows-MIT.txt` 與 upstream notice 逐位元一致，hash 已記錄；來源 HEAD 與完整 worktree status 的前後證據一致。
- `AGENTS.md` 只引用 M1 已存在的 snapshot 驗證，不預先引用 npm scripts。

## M2 — 可部署的 0-JS 垂直切片

工作：建立 Astro 骨架、site/base、基礎 layout、首頁、文章列表、文章頁、一篇 Markdown fixture＋本地圖片，以及 Pages workflow。

Done when：

- fresh clone 後 `npm ci`、`npm run verify` 依序成功；同一 commit 把 `AGENTS.md` 的正式入口更新為 `npm run verify`。
- license inventory 覆蓋 npm 全樹、Actions、vendored files 與素材；missing/unknown 為 0，第一次部署前已備妥 notices。
- production build 只產生靜態檔；沒有 server adapter、`prerender = false`、server entry／manifest 或 runtime，所有動態頁都有 `getStaticPaths()`。
- Pages build job 權限只含 `contents: read`、`pages: read`；部署寫權只在 deploy job。production concurrency 位於 workflow level，涵蓋 build 到 deploy。
- `import.meta.env.BASE_URL.endsWith("/")` 的 assertion 通過；canonical、OG、RSS 與 sitemap 的每個絕對 URL 都以 canonical root 開頭，且 `/self_blog/` 恰好出現一次。verify 的 base 取自 build 實際採用的設定來源，不是各處寫死的字串。
- `npm run test:preview` 把 `dist/` 實際掛在 `/self_blog/`；首頁、fixture 文章、CSS、圖片皆成功，network log 的 script request 數與 bytes 都是 0；不存在的深層網址回應 HTTP 404 並顯示自訂頁。
- smoke test 實際請求一個底線開頭的 `_astro/*.css` 並得到 HTTP 200，證明 Pages 沒有對該路徑做 Jekyll 過濾。
- `npm run verify:dist` 證明不存在 `.js`／`.mjs`、任何 `<script>`、`on*=`、`javascript:` URL，以及 SVG script/event/external reference；同時沒有 `node_modules`、source map、來源文件、漏 prefix、雙重 prefix或意外 root-absolute 站內 URL。
- 在臨時 isolated checkout 中不複製 `wf/` 與根 agent 入口，build 仍成功；測試不能搬動目前工作樹檔案。
- artifact 根直接包含 `index.html`、`404.html`、`posts/<fixture-slug>/index.html`，不是多包一層 `dist/` 或產生 `404/index.html`。
- PR run 只有 verify；main 的 upload、deployment、部署後 smoke test 均成功，而且 run、artifact 與被驗收 commit SHA 一致。

## M3 — 一般 blog 的完整內容管線

工作：文章與一般頁面 frontmatter schema、draft、標籤、發布月份 archive、語法高亮、heading anchor、圖片、Mermaid、RSS、sitemap、內容與連結檢查。

Done when：

- 只新增一個合規的 `posts/<path>/index.md` 資料夾，就自動產生文章 route，並出現在依日期倒序的首頁／文章列表、每個 tag 頁、對應 `/archive/YYYY/MM/` 月份頁與 RSS；不需改 registry。這些消費者都使用同一個 `getPublishedPosts()` draft filter 與排序。
- `/tags/` 能列出標籤與篇數，`/tags/<tag>/` 能列出該標籤文章；`/archive/` 能按年／月列出篇數，月份頁列出當月文章；文章顯示的發布日期連到該月份。
- 全部 tag/month route 都是 build-time 靜態 HTML，可直達、分享、以純連結操作，不需要 client-side 搜尋或篩選 JavaScript。
- article、tag、month 三組 `getStaticPaths()` 回傳值與獨立 route inventory 逐項相等；參數都是 decoded string，month 固定 `{ year: "YYYY", month: "MM" }`。
- `npm run test:content` 的正／負 fixture 證明：缺必填欄位、無標籤、重複 post/tag slug、未加引號或不存在的日期（例如 `2026-02-30`）、圖片缺 alt 或空 alt、圖片檔不存在、圖片超過 200 KiB 或 1600px、remote hotlink、壞 internal link、重複 base、公開文章 Mermaid 缺 `accTitle`/`accDescr` 或語法錯誤都會使 build 失敗。
- 只新增 `src/content/pages/<slug>.md` 就能產生 `/<slug>/`，可選自動加入導航；page slug 和保留 route／其他內容碰撞、缺 metadata 或 production draft 洩漏都會使驗證失敗。
- tag fixture 以 `技術筆記` 證明 Unicode letter 正向案例及 NFC 映射穩定；負向案例涵蓋空 slug、保留字、Unicode normalization collision、`#`、`?`、反斜線、`:`、`%`、`/`、`.` 與控制字元。不安全 segment 不可默默 percent-encode 後通過。
- production `dist/` 搜尋不到 draft canary 的 slug、標題、獨特內文或 asset（含 `media/` 內只被該 draft 引用的圖片）；draft 不被 render，也不進 route、列表、tag、archive、RSS、sitemap。本機明確預覽 draft 時才 render。
- Mermaid 是有 title/description 的靜態 SVG；頁面沒有 Mermaid runtime、inline initializer、client script 或外部 CDN request。
- 截圖有 width/height、非空 alt 與最佳化 variant；固定手機 viewport 無非預期溢出或圖片造成的 layout shift。
- 首頁、列表、tag、archive 與純文字文章的 network log 完全沒有圖片 request（無 cover、無裝飾圖）。
- 圖片集中在頂層 `media/<slug>/`，`src/content/` 下沒有任何 raster 檔案；文章只出現 `/images/...` 連結，輸出後帶正確 base 且無雙重 base。
- `dist/images/` 只含公開文章實際引用的檔案：draft canary 的圖片不在 artifact 內，孤兒檔案也不會被部署，`media/` 本身不出現在 `dist/`。
- rehype plugin 確實從本地檔案注入 width/height，並對 below-the-fold 圖片加上 `loading="lazy"`；全站 network log 對第三方 origin 是 0 request。

## M4 — 可換膚與視覺友善

工作：token contract、`miku-cyber`、`plain`、prose/code/Mermaid 樣式、responsive 與 reduced-motion。

Done when：

- token validator 證明 contract 完整，主題色 literal 只存在 theme pack；在兩個 theme 間切換只改 registry/default，文章、layout、component markup diff 為零。
- 每個 theme pack 都同時定義 light 與 dark 兩組 token 值，且顏色覆寫只出現在 `:root` 與 `prefers-color-scheme: dark` 兩處；component CSS 內沒有任何配色 media query。
- 固定 390×844 與 1440×900 viewport，兩 theme × light/dark 共四種組合，都對首頁、列表、tag、archive、長文、圖片、code、表格與 Mermaid 產生 screenshot evidence，差異經 reviewer sign-off。
- 中文 fixture 在上述四種組合下，正文每行落在 35–45 個全形字；繁中 system font fallback 在無 `Noto Sans TC` 的環境仍可讀。
- 自動檢查加人工鍵盤走查證明焦點可見、一般文字與互動元素達 WCAG AA、無 serious/critical 問題，手機與桌面沒有非預期橫向溢出。
- reduced-motion 下掃描線、漂移或光暈動畫停止；無動畫時內容仍完整。

## M5 — 上線硬化與交接

工作：404、SEO/OG、canonical、README、作者指南、預覽／部署說明、授權稽核、效能與無障礙檢查。

Done when：

- 深層不存在網址實測 `dist/404.html`；返回連結與資產帶正確 base。canonical、RSS、sitemap 皆可解析並指向正式 project-site URL。
- build output 不包含 `wf/`、`docs/`、agent 文件或 draft。
- 各類頁面的 title、description、canonical、Open Graph URL 經 fixture assertion；RSS/sitemap 只含公開文章。
- 語言宣告經 assertion：`<html lang="zh-Hant">`、RSS `<language>zh-Hant</language>`、`og:locale = zh_TW`。
- 全站沒有任何 `og:image`、`twitter:image` 或 cover 相關 markup 殘留；`public/` 只有 favicon。
- license inventory 與 `THIRD_PARTY_NOTICES.md` 雙向一致；README 區分自有內容 MIT 與第三方授權，artifact 只含閱覽成品必要的 notice，不含 build-only package 本體。
- README 可讓沒有相鄰 workflows repo 的新環境重現開發、建置與部署。
- `docs/AUTHORING.md` 經 fresh-clone walkthrough 驗證，逐步涵蓋新增／預覽／發布文章、frontmatter 的 title／description／publishedAt／updatedAt／draft／tags、本機圖片、Mermaid、一般 About／Contact 類 Markdown 頁面、導航、標籤頁與月份頁檢查，以及常見 build error；根 README 有明顯入口。
- `npm run verify:performance` 走訪完整公開 HTML route inventory並通過 [architecture.md](architecture.md) 的每項 hard budget，含三個量測 fixture（首頁、純文字文章、重量級文章）與重量級文章的 total transfer 上限。固定 mobile profile 的 Lighthouse 目標為 performance ≥95、accessibility ≥95、CLS ≤0.1，且無 serious/critical accessibility finding。
- 實際正式首頁、一個文章深層網址、一個 tag 頁、一個月份頁與不存在網址驗證成功；deployment run、報告與 commit SHA 可互相對應。

Hard byte/request budget 不可用 ADR 豁免。Lighthouse 因量測波動未達目標時可記錄原因與重測證據，但不能用來掩蓋 budget 失敗。

## 驗收證據格式

每個 milestone 的 PR 說明附 evidence matrix，不能以口頭「看起來正常」代替：

| milestone | command / action | 必要 evidence |
|---|---|---|
| M1 | snapshot validator + fixed-string scan | console/JSON report、來源 pre/post SHA/status、manifest、notice hash |
| M2 | `npm ci`、`npm run verify`、Pages run | verify report、artifact file list、base-path/0-JS smoke report、run URL + commit SHA |
| M3 | `npm run test:content` + browser assertions | positive/negative fixtures、tag/month route inventory、draft scan、static SVG/image report |
| M4 | visual/a11y commands + manual checklist | 兩 theme × 兩 viewport screenshots、contrast/focus/reduced-motion sign-off |
| M5 | `npm run verify` + deployed smoke/Lighthouse | byte/request budget、license/SEO/performance reports、deployment URL/run/commit SHA |

測試工具本身也必須通過 M0 license profile。報告在 CI 作為 artifact 保存，不放進網站輸出。

## 主要風險與緩解

| 風險 | 影響 | 緩解 |
|---|---|---|
| 忘記 Pages project base | 資產與連結部署後 404 | M2 就以 `/self_blog/` 掛載與掃描 |
| 美術改版滲入內容與元件 | 每次換風格都大改 | semantic token contract + `plain` 對照 theme |
| Mermaid build tool或產物膨脹 | CI 慢或文章過重 | 工具只留 CI；只部署 ≤100 KiB static SVG；runtime 永不進 `dist/` |
| 圖片快速膨脹 | 閱覽下載與 artifact 變大 | build-time 最佳化、variant 尺寸 gate、total transfer 上限 |
| 圖片進 git 歷史刪不掉 | repo 長期膨脹，clone 變慢 | 單檔 ≤ 200 KiB／≤ 1600px 的入口 gate；無 cover 使圖片數量需求驅動 |
| 圖片不過最佳化管線 | 未壓縮的截圖直接送給讀者 | 來源檔就是輸出檔，入口 gate 即輸出 gate；rehype plugin 在 build 時實測檔案 |
| 輸出檔名無 content hash | 換圖後讀者拿到舊快取 | 不宣告 immutable caching；換圖時換檔名 |
| draft 截圖外洩到 artifact | 未發布內容被部署 | 圖片來源目錄 `media/` 不是 `public/`；只複製公開文章引用到的檔案進 `dist/images/` |
| workflows snapshot 漂離 upstream | 規則過時、難更新 | pin SHA、逐檔 manifest、`UPSTREAM.md`、獨立更新 commit |
| 搬入 `wf/` 後連結中斷 | agent 導航失效 | 依深度重寫反向連結，做 link + forbidden-term scan |
| workflows 沒有授權 | 無法合法 vendoring | M0 先由 upstream 權利人補足 MIT；未通過不複製 |
| 「全部 MIT」定義不一致 | 審查或散布風險 | M0 記錄 license profile；第三方永遠保留原授權 |
| 科幻效果降低可讀性 | 疲勞、無障礙失敗 | 裝飾不承載資訊，限制光暈／動畫，AA 與 reduced-motion gate |
| base 尾斜線假設錯誤 | canonical/RSS/sitemap 靜默丟失 base，部署後才 404 | 單一 `ensureTrailingSlash` 入口；M2 斷言尾斜線與「`/self_blog/` 恰好一次」 |
| 逐項 budget 被組合繞過 | 每列都過但整頁破 1 MB | 重量級文章 fixture 的 total transfer 上限 |
| 中文排版沿用拉丁預設 | 行長、字型與斷行在實機失控 | 以全形字數訂 measure、明列繁中 fallback、四組合 screenshot |
