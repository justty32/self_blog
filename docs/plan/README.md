# self_blog 建置規劃（審查入口）

狀態：`Proposed`  
規劃日期：2026-08-17  
修訂：2026-08-17（審查回饋 R1，見 [OPUS_ADVICE.md](OPUS_ADVICE.md)）  
目標倉庫：`https://github.com/justty32/self_blog`  
預定網站：`https://justty32.github.io/self_blog/`

> 本輪只產出規劃：不建立網站、不安裝套件、不新增 Actions，也不複製本機 workflows checkout。

## 一句話方案

使用 Astro + TypeScript，把純 Markdown、技術截圖與 Mermaid 流程圖在 build-time 轉成 GitHub Pages 可直接提供的靜態檔；以 semantic design tokens 隔離外觀，預設採藍／青綠輕科幻主題。MVP 對閱覽者只傳 HTML、小型 CSS 與當頁圖片／SVG，全部來自本站 origin，client JavaScript 預算為 **0 bytes**。

## 需求對照

| 需求 | 規劃落點 | 完成證據 |
|---|---|---|
| 個人靜態 blog | Astro static output | `dist/` 不需 server runtime |
| GitHub Pages | project-site base `/self_blog/` + Pages Actions | main deployment 與深層網址 smoke test |
| Markdown 文章 | Content Collection 只收 `.md` | 新文章自動進列表、route、tag、RSS |
| 一般頁面與作者指南 | `pages` Markdown collection + `docs/AUTHORING.md` | 不改元件即可新增 About／Contact 類頁面；fresh-clone walkthrough 可重現 |
| 依標籤／發布月份尋找 | `/tags/`、`/tags/<tag>/`、`/archive/`、`/archive/YYYY/MM/` | 每個索引皆為可直達、可分享的靜態 HTML |
| 圖片與流程圖 | 僅技術截圖，來源在 `media/<slug>/`、文章只寫 `/images/...`；Mermaid build-time static SVG | 單檔大小/尺寸 gate、只部署被引用的圖、第三方 request 為 0；閱覽端不載 Mermaid/runtime JS |
| 非常輕量 | 0 JS、system fonts、無 analytics/CDN/client router | byte/request budget 與 network log |
| 藍／初音感、科幻但好讀 | `miku-cyber` theme + `plain` 對照 theme | WCAG AA、固定 viewport 視覺審查 |
| 外觀常更換 | semantic token contract | 切 theme 不改文章/layout/component markup |
| MIT | 自有程式、文章、圖表與素材 MIT；第三方明確稽核 | LICENSE、inventory、notices、license gate |
| 非侵入式 workflows | 根部兩個入口，其餘固定快照進 `wf/` | fresh clone 無本機路徑依賴；上游 worktree 未改 |

## 文件地圖

| 文件 | 審查重點 |
|---|---|
| [architecture.md](architecture.md) | 技術棧、內容 contract、主題、build-time Mermaid、輕量 budget、功能範圍 |
| [deployment.md](deployment.md) | `/self_blog/` base、URL contract、GitHub Pages workflow、artifact 與 404 |
| [workflow-import.md](workflow-import.md) | `C:\code\mine\workflows` 的 allowlist、適配、provenance、更新與回滾 |
| [licensing.md](licensing.md) | MIT 邊界、第三方 profile、workflows 授權 gate 與 notice |
| [milestones.md](milestones.md) | M0–M5、逐階段 Done when、證據格式與風險 |
| [review-checklist.md](review-checklist.md) | 審查者勾選決策、記錄異議與 M0 sign-off 的一頁清單 |
| [OPUS_ADVICE.md](OPUS_ADVICE.md) | R1 審查發現與決策理由；**接手實作前先看第五節「交接給實作者」** |

## 已知現況

- `self_blog` 的 `main` 與 `origin/main` 一致；規劃開始時只有標準 MIT `LICENSE`。
- 尚無框架、文章、套件、Actions 或 Pages 設定。
- remote 是 `justty32/self_blog`，所以無 custom domain 時是 project site：`https://justty32.github.io/self_blog/`。
- workflows 盤點版本是 `7e7d20bb4d30271f8369acad5f85a267d66e9be1`。
- 該 workflows commit 沒有 LICENSE、SPDX 或其他授權聲明，因此現在不能開始 vendoring。

## 預設決策

審查者若無反對意見，後續採用：

1. Astro + TypeScript + npm + Node 24 LTS，不加 React/Vue/Tailwind/CMS。
2. 無 custom domain，正式 base 為 `/self_blog/`。
3. 純 Markdown；截圖來源在 `media/<slug>/`，文章只寫 `/images/...` 連結，build 只複製公開文章引用到的檔案；Mermaid build-time static SVG。無 cover、無裝飾圖、無 OG image。
4. MVP 全站 0 client JS，不用 web font、analytics、CDN runtime、client router 或 runtime theme switch。
5. `miku-cyber` 是預設 build-time theme，`plain` 用來證明視覺解耦；兩者各自提供 light/dark 值，由 `prefers-color-scheme` 決定，不做讀者切換器。
6. workflows 採 kernel + dev + knowledge/write 的精簡 snapshot，其餘按需求成長。
7. 所有自有程式、文章與自製素材 MIT；第三方預設採明列 permissive allowlist並保留原授權。

## M0 前不能略過的 gate

1. **workflows 授權**：上游必須先新增 scope 足夠的 MIT LICENSE，再 pin 新 commit；現有 `7e7d20b...` 不可複製。
2. **第三方授權 profile**：預設是「自有產物 MIT + 明列 permissive third-party」；若要求連 transitive dependency 都只能 MIT，須明確改選 strict profile並重新驗證技術棧。
3. **審查記錄**：接受本規劃時記錄 reviewer、日期、plan commit SHA、license profile 與 custom-domain 決策，再把狀態改為 `Accepted`。

## 執行順序

```text
M0 審查／授權 gate
  → M1 非侵入式 workflows snapshot
  → M2 可部署的 0-JS 垂直切片
  → M3 完整 Markdown／圖片／標籤／月份 archive／靜態 Mermaid 管線
  → M4 可換膚與無障礙
  → M5 上線硬化與交接
```

各階段的命令、fixture 與證據要求見 [milestones.md](milestones.md)。
