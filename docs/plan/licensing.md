# 授權與供應鏈規劃

← [規劃入口](README.md)｜[workflows 導入](workflow-import.md)｜[里程碑](milestones.md)

## 授權邊界

- 本 repo 自行創作的 templates、CSS、scripts、文章與自有素材由根 `LICENSE` 以 MIT 發布。
- Hugo 不屬於本專案的自有內容，也不把 Hugo 或其依賴重新授權為 MIT。
- 正式輸出不包含 Hugo binary；Hugo 只在本機／CI 作為 build-time 工具。
- 自製技術截圖納入 repo 的 MIT 範圍；若截圖包含第三方 UI／素材，仍須個別確認權利並
  記錄 notice，不能因檔案放進本 repo 就宣稱第三方部分已改成 MIT。
- 字型、圖示與外部素材必須有明確來源與可再散布授權，否則不得納入。首版只用 system
  fonts、自有 CSS／favicon 與上述經核對的技術截圖。

## 固定建置工具

正式建置固定使用 Hugo `v0.165.0` standard binary，Apache-2.0。Linux amd64 與 Windows amd64 的官方 release checksum 必須進入實作期的驗證 gate：

| 平台 | artifact | SHA-256 |
|---|---|---|
| Linux amd64 | `hugo_0.165.0_linux-amd64.tar.gz` | `5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432` |
| Windows amd64 | `hugo_0.165.0_windows-amd64.zip` | `bdd9cc7837a42389067b2d0df7858d5878ceddef21307c2dd27fa10885fbbcf9` |

上表兩個值已與同一 v0.165.0 release 的官方 `checksums.txt` exact entry 核對；這是 manifest
證據，不冒充跨平台 runtime 證據。每次下載後仍必須先驗實際檔案 SHA-256，再檢查
`hugo version`。Ubuntu gate 必須明確得到 `v0.165.0`、`linux/amd64`、standard；Windows
作者流程則得到相同版本、`windows/amd64`、standard。`extended`、`withdeploy`、浮動 tag 與
package-manager 安裝均不符合此 gate。官方來源：[Hugo v0.165.0 release](https://github.com/gohugoio/hugo/releases/tag/v0.165.0)、[Hugo license](https://gohugo.io/about/license/)。

## 依賴與授權 gate

- 正式網站不引入 npm、`package.json`、`package-lock.json`、Go module、Hugo theme 或遠端
  module。現有 Mermaid spike 在獨立 cleanup commit 移除前只屬歷史研究，任何正式
  build／CI／publish command 都不得安裝或執行它。
- 不使用遠端 `resources`、remote CSS/JS/font/image，也不使用 git submodule 作為網站依賴。
- Profile B 允許 Apache-2.0、MIT、ISC、BSD-2-Clause、BSD-3-Clause、0BSD、CC0-1.0、Unlicense 等 permissive license；每個 SPDX expression 先拒絕 unknown ID，`OR` 至少一個核准分支、`AND` 每個分支都須核准。
- unknown、missing、新增或版本變更的依賴一律 fail closed；例外只能由獨立 ADR 核准，不能只改 allowlist。
- Hugo 自身的 Apache-2.0 與其編譯依賴的授權不可混為一談。只在 build-time 使用不代表可省略稽核；保留版本、checksum、來源與 inventory。不要聲稱 Hugo 有不存在的 `NOTICE`。
- GitHub Pages Actions 必須使用 official repository 的完整 commit SHA，並在實作前重新核對 tag、nested actions 與各自 license。不可使用 major tag 或 branch。
- Git 與 PowerShell 7 是作者機器／GitHub-hosted runner 的 host prerequisites，不 vendoring、
  不由本站 workflow 下載，也不進 Pages artifact；CI 仍記錄 exact versions。若未來改由 repo
  自行下載或散布其中任一工具，必須先擴充 inventory／ADR，不能沿用此環境邊界。

## 輸出與 workflow gate

- Pages artifact 不得包含 Hugo、npm、theme、module、source dependency 或未引用素材。
- build 後檢查輸出不得含 client `<script>`、第三方 origin、遠端資源或意外檔案；讀者取得的是普通 HTML、CSS 與圖片。
- workflows 精簡快照固定於 `368468a0cda612ffeb4d70bb72f39e765ed73327`，核心來源採 CC0-1.0（既有 permissive allowlist 允許）；原始全文保存在 [LICENSE.workflows-CC0.txt](../../wf/LICENSE.workflows-CC0.txt)，逐檔來源見 [UPSTREAM.md](../../wf/UPSTREAM.md)。不包含另有授權的 skills；舊缺授權 commit 不作為導入來源。

## 交付文件

M2 首次部署前產生 `THIRD_PARTY_NOTICES.md` 或等價 inventory，記錄 Hugo release、checksum、Actions SHA、第三方素材與必要 notice。這份 inventory 必須能與 repository 檔案及 Pages artifact 雙向核對。

Hugo 方案取代 Mermaid／npm 方案的正式實作權威，詳見 [ADR-0002](adr/0002-hugo-no-npm.md)。Mermaid spike 僅保留為歷史驗證，並不代表 production 依賴。
