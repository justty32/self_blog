# 網站架構

[文件入口](README.md)｜[作者指南](AUTHORING.md)

網站使用固定的 Hugo Standard，在建置時把 Markdown、Go templates 與 CSS 產生成品。
訪客只載入 HTML、CSS 與圖片，沒有 JavaScript、theme、遠端 module 或 npm 相依。

## 內容與網址

`content/` 是唯一內容來源。文章使用 `content/posts/<年份>/<短名>/index.md` page bundle，
圖片與文章放一起；一般頁面放在 `content/`。網址由 `hugo.toml` 的 baseURL 和 permalink
決定，文章沿用 `/posts/:year/:contentbasename/`。相容網址由文章 front matter 的 aliases 保留。

主導覽在 `hugo.toml` 的 `menus.main` 設定，`pageRef` 指向 Hugo 頁面；新增頁面不需修改版型。
RSS 只收公開文章，文章清單、月份索引與 RSS 共用 `published-posts.html`。
robots.txt 從 baseURL 產生 sitemap 位置，換網域或 project base 時不需另改靜態網址。

## 版型與樣式

`layouts/baseof.html` 管理文件骨架，home、page、section、taxonomy、term、archive、404
各自提供內容。共用 partial 管理 head、導覽、頁尾、頁面標題、文章卡片與標籤；
`layouts/_markup/` 負責 Markdown 圖片和連結。

CSS 按職責拆在 `assets/css/`：

| 檔案 | 職責 |
|------|------|
| `base.css` | 色彩變數、全域排版與基礎元素 |
| `layout.css` | 頁面容器、導覽與主要區塊 |
| `components.css` | 卡片、標籤等元件 |
| `prose.css` | 文章、程式碼與圖片 |
| `preferences.css` | light theme、響應式、減少動畫 |

`layouts/_partials/styles.html` 明確指定合併順序。Hugo 將它們合成同一個 `/css/site.css`，
維持單一 CSS request；不使用瀏覽器端 CSS import，也不需要額外編譯工具。

## 腳本邊界

公開指令留在 `scripts/`，共用實作放 `scripts/lib/`：

| 入口／模組 | 職責 |
|-----------|------|
| `get-hugo.ps1` | 固定版本工具入口，載入 release／archive／cache helpers |
| `HugoRelease.ps1` | manifest、checksum 與 binary 版本 |
| `HugoArchive.ps1` | ZIP／tar 安全解壓 |
| `HugoCache.ps1` | 快取鎖、下載、暫存與安裝 |
| `Common.ps1` | 相容載入入口，載入 Paths 與 Processes |
| `Paths.ps1`／`Processes.ps1` | 路徑檢查、程序執行與 UTF-8 傳輸 |
| `verify.ps1` | production build 與讀取 Hugo 實際設定 |
| `SiteValidation.ps1` | 純產物檢查，可用離線 fixture 測試 |
| `publish.ps1` | main、乾淨 index、僅 content 變更的發布流程 |

預設取得 Hugo 會連網核對官方 checksum；離線建置可傳
`verify.ps1 -HugoPath <已驗證的 binary>`。自動下載支援 Windows／Linux amd64；
Linux tar 解壓另需 .NET 7 以上的 PowerShell runtime。

## 驗證與交付

```powershell
pwsh -NoProfile -File scripts/test-automation.ps1
pwsh -NoProfile -File scripts/test-site-validation.ps1
pwsh -NoProfile -File scripts/verify.ps1
pwsh -NoProfile -File scripts/verify-workflow-snapshot.ps1
pwsh -NoProfile -File scripts/test-workflow-snapshot.ps1
```

產物檢查涵蓋基礎輸出、0 JavaScript、站內連結與 base path、RSS／sitemap XML。
base path 從 Hugo 實際設定讀取，支援壓縮後不帶引號的 HTML 屬性；不依賴某篇範例文章存在。
圖片 alt／遠端來源由 render hook 檢查。這些檢查不代表已做效能、可及性或視覺完整驗收。

GitHub Actions 在 Windows／Linux 執行同一套檢查；Pages build 只讀取 repository 與 Pages 設定，
部署 job 才取得 pages write 與 id-token write。`public/` 是建置產物，不提交。

工作流採獨立 `wf/` 快照；網站 build／publish 不讀取它，CI 另外執行快照驗證。
