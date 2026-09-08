# 寫作與發布指南

這個網站的日常流程是：新增 Markdown → 本機預覽 → 執行一個發布指令 → GitHub Actions 自動部署。

## 第一次準備

目前自動下載工具支援 Windows 與 Linux 的 x86-64（amd64）。兩個平台都需要：

- Git
- PowerShell 7（`pwsh`）
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

若要讓新頁面出現在頂部導覽，再編輯 `layouts/_partials/header.html` 加一個連結。一般頁面不必加入 tags 或 date。

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

產物位於 ignored 的 `public/`，不要提交它。

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
