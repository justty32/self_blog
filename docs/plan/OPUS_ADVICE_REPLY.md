# 對 `OPUS_ADVICE.md` R2 的回覆

- 回覆日期：2026-08-17
- 回覆範圍：[`OPUS_ADVICE.md` 第六節](OPUS_ADVICE.md#六r2-審查hugo-轉向後)
- 審查基準：`febc67d`（`docs: pivot blog plan to Hugo`）
- 結論：**部分接受；A4、A5 的事實判斷駁回，其餘裁決已同步至正式規格**

本文件是對外部審查的回覆與 disposition record，不取代正式規格。正式規格仍以
[`README.md`](README.md) 及其連結文件為準。這一輪只修訂規劃；不建立 Hugo 網站、
不移除歷史 spike，也不開始部署。

> **同步狀態：完成。** A4／A5 已依官方文件還原，其餘裁決也已寫入正式規格。只有同時
> 包含本回覆、正式規格與 ADR 修訂的新 plan commit 才可供 sign off；不能只提交本檔，
> 也不能在取得該 commit SHA 前開始 cleanup、gate 或 Hugo 實作。

## 一、摘要

| 項目 | 裁決 | 後續處理 |
|---|---|---|
| A4 `locale`／`languageCode` | **駁回** | 已恢復 `locale = "zh-Hant-TW"`；保留輸出 assertion |
| A5 `reflect.IsImageResourceWithMeta` | **駁回** | 已恢復 Hugo 官方現有 helper；保留格式、尺寸與檔案 gate |
| A6 template layout | **接受** | 採 Hugo 0.146+ 新結構，並以 v0.165.0 fixture 驗證 lookup |
| B9 build 目錄 ignore | **接受** | 第一次執行 Hugo 前建立 `.gitignore` |
| B10 archive 無上限 | **接受** | 增加 archive hard budget；超標時另立 ADR 改路由／分頁 |
| B11 Linux checksum 證據 | **接受** | 補官方 manifest 證據；Ubuntu gate 再驗下載檔與版本 |
| B12 unrelated dirty files | **接受並收緊隔離** | 不 stage、不阻擋；在隔離的 selected snapshot 驗證 |
| C1 流程圖 | **決定不納入 MVP** | 理由是目前不需要，不宣稱原生 binary 方案不可行 |
| C2 CI matrix | **接受** | Ubuntu 跑完整 gate；Windows 跑作者流程與跨平台子集 |

## 二、A4：`locale` 才是 Hugo v0.165.0 的現行設定

R2 聲稱 Hugo 沒有 `locale`、應改用 `languageCode`。這與目前 Hugo 官方文件相反：

- `languageCode` 自 Hugo v0.158.0 起已 deprecated；官方要求改用 `locale`。
- `locale` 用於語言本地化，並供 Hugo 的內建 alias、RSS 與 Open Graph template 使用。
- `locale` 可作為 root-level localized setting；本站是單語網站，不需要為此建立多語
  `[languages]` 設定，也不需要額外設定 `defaultContentLanguage`。

因此正式規格應恢復為：

```toml
baseURL = 'https://justty32.github.io/self_blog/'
locale = 'zh-Hant-TW'
timeZone = 'Asia/Taipei'
```

R2 提議驗證實際輸出，而不是只檢查設定文字，這個方向仍然接受。第一個 Hugo gate 必須
斷言生成的 `<html lang="zh-Hant-TW">`、RSS `<language>zh-Hant-TW</language>`，以及預期的
Open Graph locale；設定存在但輸出錯誤仍算失敗。

依據：[Hugo — Configure languages](https://gohugo.io/configuration/languages/)。

## 三、A5：`reflect.IsImageResourceWithMeta` 確實存在

R2 聲稱 `reflect` namespace 只有 `IsMap` 與 `IsSlice`，亦與 Hugo 官方文件相反。
`reflect.IsImageResourceWithMeta` 自 v0.157.0 起存在，v0.165.0 當然包含它；官方用途正是
判斷 Hugo 能否從該 image resource 取得 dimensions 與 metadata。

正式規格應要求 image render hook 採以下順序：

1. destination 必須符合本站的 local logical path contract。
2. `resources.Get` 必須取得資源。
3. 副檔名必須是 PNG、JPEG 或 WebP。
4. `reflect.IsImageResourceWithMeta $resource` 必須為真，才讀取 `.Width`／`.Height`。
5. alt、來源 byte size、最長邊、draft／orphan isolation 與 artifact 引用集合仍分別由既定
   gate 驗證。

`.ResourceType`／`.MediaType` 可作補充 assertion，但不能用「helper 不存在」作為替換理由。

依據：[Hugo — reflect.IsImageResourceWithMeta](https://gohugo.io/functions/reflect/isimageresourcewithmeta/)。

## 四、A6：採用 Hugo 0.146+ 新 template system

這項審查接受。Hugo 0.146 起的新結構移除 `_default/`，將 `partials/` 改為 `_partials/`，
render hooks 放在 `_markup/`，並以 `home`、`page`、`section`、`taxonomy`、`term` 等 kind
參與 template lookup。本站會統一採用新結構，不混用舊路徑：

```text
layouts/
  baseof.html
  home.html
  page.html
  section.html
  taxonomy.html
  term.html
  home.rss.xml
  _markup/{render-image,render-link}.html
  _partials/...
```

文件正確不代表功能已證明。第一個 Hugo gate 仍須使用 exact v0.165.0 minimal fixture，
為每個會使用的 page kind、render hook 與 RSS template 放入 sentinel，並斷言生成 artifact
真的來自預期 template；不能只測「build 沒報錯」。

依據：[Hugo — New template system in v0.146.0](https://gohugo.io/templates/new-templatesystem-overview/)。

## 五、B9：三個產出目錄必須先 ignore

接受。第一次執行 Hugo 前，cleanup commit 必須建立 `.gitignore`，至少包含：

```gitignore
/public/
/resources/
/.hugo-validation/
```

gate 另須證明這三個路徑都未被 Git tracked 或 staged。即使 B12 改為允許無關的 unstaged
變更，build output 仍不應污染 `git status`，也不得被任何發布命令納入 commit。

## 六、B10：為 `/archive/` 增加 hard budget

接受單頁月份索引，但補上明確成長界線：

- `/archive/` 維持單一靜態頁，以 `YYYY-MM` anchors 分組；MVP 不產生月份獨立 route。
- archive 首次載入的 HTML、共用 CSS 與 favicon 合計 **不得超過 120 KiB transfer**、
  **不得超過 6 requests**，且必須是 **0 JavaScript、0 image request**。
- verifier 使用與其他頁面相同的 raw-byte 與 auto-load closure 計算方式：
  `1 KiB = 1024 bytes`，不模擬 gzip／Brotli／HTTP headers；HTML preload 與 CSS
  `@import`／`url()` 都要納入。
- 新文章若使 budget 超標，build 應 fail closed；不得直接放寬數字。屆時另立 ADR，在
  static pagination 與月份獨立頁之間選擇。

這比預先猜「第幾篇文章一定超標」更穩定，因為真正要限制的是讀者下載量，而不是文章數。
月份 anchor 的路由決策已由 [ADR-0003](adr/0003-month-archive.md) 記錄，不再只埋在架構段落裡。

## 七、B11：Linux checksum 證據

接受。官方 v0.165.0 release 的 checksum manifest 中，standard Linux amd64 artifact 為：

```text
5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432  hugo_0.165.0_linux-amd64.tar.gz
```

Windows amd64 則為：

```text
bdd9cc7837a42389067b2d0df7858d5878ceddef21307c2dd27fa10885fbbcf9  hugo_0.165.0_windows-amd64.zip
```

本回覆只把官方 manifest 的 exact entry 記為規劃證據；不能假裝 Linux binary 已在 Windows
環境執行。第一個 Ubuntu gate 仍須下載 exact artifact、先比對 SHA-256，再解壓並要求
`hugo version` 回報 `v0.165.0`、`linux/amd64`、standard edition。任何一步不符即停止。

依據：[Hugo v0.165.0 release](https://github.com/gohugoio/hugo/releases/tag/v0.165.0)。

## 八、B12：允許無關 dirty files，但不能讓它們影響驗證

接受 reviewer 指出的可用性問題，但只改成「不阻擋」仍不夠安全。若本機未提交的 CSS
參與 validation build，而 publish commit 最後只包含文章，CI 會建出不同結果。

正式發布 contract 改為：

- 起始 real index 必須完全乾淨，不接受任何既有 staged／partial-staged state。
- 選定 content unit 以外的 **unstaged／untracked** 變更不阻止發布；命令清楚列出
  「本次排除且不會提交」的路徑。
- temporary Git index 從 `HEAD` 加入本次 selected content unit 與 owned media，產生 candidate
  tree ID；驗證只對該 tree 的隔離 snapshot 進行，不能讀取其他工作樹變更。
- 回到原工作樹後只執行 exact-path `git add -- <allowlist>`；real index 與最終 commit 的
  tree ID 都必須等於已驗證 candidate tree ID。禁止 `git add -A`。
- `public/` 被 tracked／staged、驗證失敗、選定內容在驗證期間改變、remote／branch 不符，
  仍然 hard fail。

這樣可以一邊修改網站樣式、一邊發布文章，又能保證本機驗證與 CI 實際收到的 commit 相同。

## 九、C1：MVP 不保留流程圖

這項已由使用者拍板：流程圖可以捨去，因此不納入 MVP。理由是目前的普通 blog 需求不需要
它，並且每增加一個 renderer 都會增加版本、checksum、授權與 SVG 安全維護面；不是因為
「不用 npm 就做不到」。

D2／Graphviz 的 pinned native binary 方案在技術上成立，但現在沒有使用需求，所以不加入。
若未來文章確實需要圖表，再以獨立 enhancement ADR 比較 D2、Graphviz 與既有 Mermaid spike。
現有 Mermaid spike 依原計畫在獨立 cleanup commit 從工作樹移除，Git history 保留研究證據。

## 十、C2：縮小 Windows CI，而不是放棄 Linux 支援

接受。兩個作業系統仍屬正式作者環境，但 CI 不再把昂貴工作完整重跑兩次：

- **Ubuntu amd64**：完整 checksum、content validation、production build、template sentinel、
  artifact/base/link/0-JS/image/archive budget gate，以及 Pages artifact/deploy path。
- **Windows amd64**：Hugo checksum/version、PowerShell 腳本解析、path normalization、
  content-unit selection、exact staging allowlist、圖片路徑與最小 Hugo smoke fixture。
- Windows job 在 fresh disposable Git fixture 以 `publish.ps1 -TestMode` 實際走到 candidate
  tree／staging assertion，並證明 HEAD 未變、無 commit／push／網路寫入；只 parse script
  不算通過。它不重跑效能量測、部署或完整站點 smoke。

Windows 與 Linux 仍使用同一個 `publish.ps1` contract，不維護另一份 Bash 實作。

## 十一、其餘小項目

- GitHub Pages 參考連結接受修正為
  [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
- `module.mounts` 取代預設 mounts 的風險會在 `hugo.toml` 旁加註；目前只掛入實際使用的
  `assets`、`content`、`layouts`、`static` 與 local `media`。`data`、`i18n`、`archetypes`
  目前不用，未來啟用時必須同步新增 mount 與 fixture。
- 根目錄空 `scripts/` 不構成 Git 內容；第一個 gate commit 建立正式 scripts 時自然使用它。
- `spikes/mermaid-renderer/`、其 lockfile 與本機 ignored `node_modules/` 在 plan sign-off 後由
  獨立 cleanup commit 移除；不與 gate 或 Hugo 功能混在同一 commit。
- `/archive/` 的單頁月份 anchors 與 hard budget 已由
  [ADR-0003](adr/0003-month-archive.md) 記錄。

## 十二、修訂順序

1. 提交本回覆與修正後的 plan／ADR，取得新的 plan commit SHA。
2. 獨立 cleanup commit：移除歷史 Mermaid spike 的工作樹檔案、清理其本機
   `node_modules/`，並在第一次 Hugo 執行前建立 `.gitignore`。
3. 獨立 gate commit：加入 exact Hugo/checksum、template lookup、content/image、base、
   archive budget、publish isolation 與 0-JS 的負向 fixtures；先證明錯誤輸入會被擋下。
4. 下一個 commit 才加入 Hugo 最小垂直切片，使既有 gate 轉綠。

在第 1 步獲得規劃 sign-off 前，不開始第 2–4 步。
