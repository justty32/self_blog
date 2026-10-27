# 寫作與發布指南

[文件入口](README.md)｜[網站架構](ARCHITECTURE.md)

這個網站的日常流程是：新增 Markdown → 本機預覽 → 執行一個發布指令 → GitHub Actions 自動部署。

## 第一次準備

目前自動下載工具支援 Windows 與 Linux 的 x86-64（amd64）。兩個平台都需要：

- Git
- PowerShell 7（`pwsh`）；Linux 解壓 tar 需要 PowerShell 7.3／.NET 7 以上
- 網路連線；`scripts/get-hugo.ps1` 會下載並驗證固定的 Hugo v0.165.0，不需要 npm 或 Node

Linux 同樣使用 PowerShell 7，請先確認 `pwsh --version` 可執行；`.ps1` 指令應由 `pwsh` 執行，不要交給 Bash。ARM64 目前不在自動下載工具的支援範圍。

GitHub Actions 的 `Verify Windows and Linux` 會在 pull request 與 main 更新時，分別執行兩個平台的建置與腳本回歸測試。

第一次部署前，到 GitHub repository 的 **Settings → Pages → Build and deployment**，把 Source 選為 **GitHub Actions**。

## 新增文章

在 `content/posts/<年份>/<英文短名>/` 建立 `index.md`：

```text
content/
  posts/
    2026/
      my-first-post/
        index.md
```

最小內容：

```yaml
---
title: 我的第一篇文章
description: 列表與搜尋結果會顯示的簡短摘要
date: 2026-08-17
tags:
  - Hugo
  - 筆記
---

從這裡開始寫 Markdown。
```

可選欄位：

```yaml
lastmod: 2026-08-18
draft: true
categories:
  - 工具
```

- `tags` 會自動產生 `/tags/` 與每個標籤頁。
- `date` 會決定文章排序及 `/archive/` 的月份分組。
- `draft: true` 不會出現在正式網站；本機預覽時加 `--buildDrafts` 才看得到。
- 發布年份與資料夾短名會組成網址，例如上面的文章會位於 `/posts/2026/my-first-post/`。

## 加入圖片

把圖片和文章放在同一個資料夾：

```text
content/posts/2026/my-first-post/
  index.md
  terminal.webp
```

Markdown 使用相對路徑，並填寫有意義的 alt text：

```markdown
![終端機顯示建置成功](terminal.webp)
```

Hugo 會在建置時讀取圖片尺寸並輸出普通的 `<img>`；遠端圖片與空白 alt 會讓建置失敗。建議使用 WebP、PNG 或 JPEG，單張盡量小於 200 KiB。

## 新增一般頁面

About、Contact 這類頁面直接放在 `content/`：

```text
content/projects.md  → /projects/
```

內容至少需要：

```yaml
---
title: 專案
description: 我做過的東西
---

頁面內容。
```

若要讓新頁面出現在頂部導覽，在 `hugo.toml` 新增一筆：

```toml
[[menus.main]]
  name = "專案"
  pageRef = "/projects"
  weight = 60
```

`weight` 控制順序。一般頁面不必加入 tags 或 date。

## 調整網站外觀

網站右上方的「外觀」面板可切換光網、閱讀與深空風格，調整六個基準色、動態效果，
並選擇是否開啟沉浸互動。這些調整只保存在目前瀏覽器，不會改變其他訪客看到的預設。
各風格的自訂色分別保存；「重設配色」會恢復目前風格的預設色。沉浸模式不跨頁自動開啟，
每頁須按一次按鈕；系統設定減少動畫時不啟用。

若要修改全站預設，編輯 `data/appearance.toml`。最上方的 `default_style` 可設為
`"grid"`、`"paper"` 或 `"deep"`，決定首次造訪及停用 JavaScript 時的預設風格；
訪客已保存的風格選擇優先。每種風格使用相同的六個色彩欄位：

| 欄位 | 用途 |
|------|------|
| `bg` | 網頁背景 |
| `surface` | 卡片與設定面板基底 |
| `text` | 主要文字 |
| `muted` | 次要說明與標記 |
| `primary` | 主色、連結與主要互動 |
| `secondary` | 輔色與光線層次 |

例如調整光網風格的主色，就修改 `[styles.grid]` 下的 `primary = "#75d9e6"`。
色碼必須使用完整的 `#RRGGBB`；同樣可修改 `[styles.paper]` 或 `[styles.deep]`。
邊線、陰影、光暈與粒子會依這些基準色衍生，不需要在 CSS 或 JavaScript 逐處換色。
改完重新建置與預覽，檢查正文、次要文字和連結在新背景上的辨識度；已有本機自訂色的
瀏覽器須先按「重設配色」，才會顯示新的預設。

部署目錄 `public/` 的總大小採 5,000,000 bytes 預算，建置檢查超過即失敗。
圖片也計入總量；盡量使用壓縮過的素材，避免大型影片或網路字體。
外觀設定屬於網站程式變更，依一般 Git 提交與部署流程處理，不使用僅接受 `content/` 的發布腳本。

## 本機預覽

Windows 與 Linux 使用相同命令：

```powershell
$hugo = ./scripts/get-hugo.ps1
& $hugo server --buildDrafts --baseURL http://127.0.0.1:1313/self_blog/
```

然後開啟 <http://127.0.0.1:1313/self_blog/>。

只做一次正式建置與基本檢查：

```powershell
./scripts/verify.ps1
```

產物位於 ignored 的 `public/`，不要提交它。預設檢查即使已有 Hugo 快取仍需連網核對 checksum；離線時使用 `./scripts/verify.ps1 -HugoPath <已驗證的 Hugo binary>`。

從 Linux Bash 執行檢查：

```bash
pwsh -NoProfile -File ./scripts/verify.ps1
pwsh -NoProfile -File ./scripts/test-automation.ps1
```

第二個指令離線測試快取鎖與發布前置檢查，使用獨立暫存 repository，不會發布文章。

## 一個指令發布

完成一篇文章或一般頁面後執行：

```powershell
./scripts/publish.ps1 -Message "content: add my first post"
```

這個指令只接受 `content/` 的變更，會依序：

1. 建置並檢查網站。
2. 提交 `content/`（文章圖片也在其中）。
3. push 到 `origin/main`。
4. 由 GitHub Actions 重新建置並部署 Pages。

若同時修改了版型、CSS、設定或 workflow，請先把那些網站程式變更另行 review、commit、push，再發布文章。
