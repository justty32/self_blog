# 規劃審查清單

← [規劃入口](README.md)｜[架構](architecture.md)｜[部署](deployment.md)｜[workflows 導入](workflow-import.md)｜[授權](licensing.md)｜[里程碑](milestones.md)

用途：讓審查者快速判斷本規劃能否由 `Proposed` 進入 `Accepted`。本檔不代表已接受，也不授權開始實作。

## 1. 需求沒有被縮減

- [ ] GitHub Pages 靜態 blog，正式 project-site URL 與 `/self_blog/` base 已被接受。
- [ ] 每篇內容仍是純 Markdown，可用 `/images/...` 連結引用技術截圖並以 Mermaid fence 撰寫流程圖；無 cover、無裝飾圖、無 OG image。
- [ ] `title`、`slug`、`description`、`publishedAt`、`draft`、`tags` 為必填；每篇至少一個 tag。
- [ ] 閱讀者可由 tag index、per-tag page、archive index 與 `/archive/YYYY/MM/` 尋找文章。
- [ ] 上述頁面全部 build-time 產生，重新整理／分享仍有效，不依賴瀏覽器端搜尋或篩選。
- [ ] article、tag、month route 共用同一份公開文章投影，`getStaticPaths()` 與 route inventory 完全相等。
- [ ] 預設是藍／青綠輕科幻但可讀的 `miku-cyber`；視覺更換不修改文章與 component markup。
- [ ] 自有程式、文章、圖表與素材採 MIT；第三方授權邊界及 notices 清楚。
- [ ] workflows 採可追溯、可回滾、無本機路徑依賴的精簡 snapshot。

## 2. 輕量契約

- [ ] MVP 所有頁面 client JavaScript 是 0 bytes、0 requests。
- [ ] 0-JS verifier 也拒絕任何 `<script>`、event handler、`javascript:` URL 與不安全 SVG，不只計算 network request。
- [ ] Mermaid 只在 build/CI 執行，部署的是 static SVG，不是 Mermaid runtime。
- [ ] 不加入 UI framework、web font、analytics、CDN runtime、client router、prefetch framework 或 hydration。
- [ ] CSS、首屏、典型文章、圖片及 SVG 的 hard budgets 合理且不可被 ADR 豁免，並有一條整頁 total transfer 上限擋住組合繞過。
- [ ] npm／Node／Astro／renderer 都是 build tool，不會被打包成訪客下載內容。

詳細數值見 [architecture.md 的訪客下載 hard budget](architecture.md#7-訪客下載-hard-budget)。

## 3. 必須明確接受或改寫的決策

| ID | 預設 | 審查結果／異議 |
|---|---|---|
| D1 | Astro + TypeScript + npm + Node 24 LTS，無 UI framework | |
| D2 | 無 custom domain；`site=https://justty32.github.io`、`base=/self_blog` | |
| D3 | 純 Markdown、圖片集中於 `media/<slug>/`、build-time static Mermaid SVG | |
| D4 | 全站 0 client JS；不做 runtime theme switch | |
| D5 | `miku-cyber` 預設、`plain` 作解耦證據 | |
| D6 | tags 與發布月份都是 build-time 靜態導航 | |
| D7 | workflows 只導入 kernel + dev + knowledge/write allowlist | |
| D8 | license profile B 為預設；strict MIT-only 只有明確要求才採用（選 A 等於重新選型） | |
| D9 | 每個 theme pack 同時提供 light/dark 兩組 token，由 `prefers-color-scheme` 決定；無讀者可操作的切換器 | 已接受（R1） |
| D10 | 中文排版指標以全形字計（每行 35–45 字），繁中 system font fallback，不用 web font | 已接受（R1） |
| D11 | 重量級文章 fixture 的 total transfer ≤ 400 KiB、≤ 12 requests | 已接受（R1） |
| D12 | 文章可有技術截圖；但無 cover/縮圖、無裝飾或角色圖、無 `og:image`。`miku-cyber` 只是配色名稱 | 已接受（R1） |
| D13 | 圖片與文章分開放但同 repo：來源在 `media/<slug>/`，文章只寫 `/images/...`，build 只複製公開文章引用到的檔案；單檔 ≤ 200 KiB／≤ 1600px，rehype plugin 注入 width/height | 已接受（R1） |

內容 contract 另需確認：date-only 值使用加引號的真實 `YYYY-MM-DD` 並通過曆法驗證；month key 不依 CI 時區；tag route validator 使用帶 `u` flag 的 Unicode letter／number／hyphen allowlist，且 `技術筆記` 正向 fixture 在 NFC 前後映射一致，再交由 Astro 編碼。

若要改任何預設，必須在開始對應 milestone 前修改架構／部署／授權文件及 Done when，不能只在審查留言中口頭改變。

## 4. 目前不能勾過的外部 gate

- [ ] workflows upstream 已新增完整、scope 足夠的 MIT LICENSE，且本專案改 pin 含授權的新完整 SHA。
- [ ] reviewer 已確認該授權涵蓋既有 allowlist 內容、既有貢獻與衍生來源。
- [ ] 預定 Astro、Mermaid renderer、Actions 與完整 dependency tree 已通過所選 license profile 的可行性 inventory。

截至 2026-08-17，盤點的 workflows commit `7e7d20bb4d30271f8369acad5f85a267d66e9be1` 沒有授權聲明；所以目前 verdict 只能是 `Changes requested`，不能是 `Accepted`。

## 5. Sign-off 記錄

`plan_commit_sha` 需要這份規劃已經進版控，所以簽核前先把 `docs/plan/` commit 起來，再以該 SHA 填表。

接受規劃時填寫：

```text
reviewer:
reviewed_at:
plan_commit_sha:
license_profile: B-permissive | A-strict-MIT-only
custom_domain: none | <decision reference>
verdict: Accepted | Changes requested
blocking_findings:
notes:
```

只有 `blocking_findings` 為空、外部 gate 全部有可持久驗證的證據，而且相關文件已對應修正時，才能把 [規劃入口](README.md) 的狀態改成 `Accepted` 並開始 M1。

## 6. 官方契約核對（2026-08-17）

- [Astro configuration reference](https://docs.astro.build/en/reference/configuration-reference/)：`output: static`、`base`、`BASE_URL`、`trailingSlash` 與 directory build contract。
- [Astro dynamic routes](https://docs.astro.build/en/guides/routing/#dynamic-routes)：static dynamic route 必須由 `getStaticPaths()` 列舉。
- [Astro Content Collections API](https://docs.astro.build/en/reference/modules/astro-content/)：build-time collection、`glob()` loader 與 local `image()` schema helper。
- [Astro Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)：`deferRender` 避免 content sync 預先 render draft。
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)：configure、artifact upload、deploy、permissions 與 environment contract。
- [GitHub Pages 404 troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites)：部署 artifact 根必須有 `index.html`。
- [Node.js releases](https://nodejs.org/en/about/previous-releases)：Node 24 仍為 LTS；實作開始時仍須重新核對受支援版本。
