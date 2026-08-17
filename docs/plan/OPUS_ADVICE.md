# R1 審查發現與修改記錄

← [規劃入口](README.md)

審查日期：2026-08-17  
審查範圍：`docs/plan/` 全部六份文件（審查時尚未進版控）  
審查結論：同意 [review-checklist.md](review-checklist.md) 的 `Changes requested`，但 blocking 理由不只「workflows 沒授權」一項。

本檔記錄歷次審查的**修正、決策與理由**。第一至五節是 R1（Astro 方案）；[第六節](#六r2-審查hugo-轉向後)是 R2，針對轉向 Hugo 之後的現行規劃。

> **這份文件不是規格。** 規格在另外六份文件裡；本檔只保存「為什麼是這樣」。要改計畫請改那六份，不要把這裡當 source of truth，也不要讓兩邊分歧。
>
> 接手實作的人請直接看 [第五節「交接給實作者」](#五交接給實作者)。

> **2026-08-17 轉向說明：** 第一至四節記錄的是 Astro／Mermaid 方案的 R1
> 歷史，不能再當作現行實作指示。屋主後續把 build-time 供應鏈縮減列為優先，
> 並同意移除流程圖；現行決策改為 Hugo standard、無 npm、無 Mermaid，詳見
> [ADR-0002](adr/0002-hugo-no-npm.md)。第五節已依新決策重寫。

---

## 一、已套用的修正

### A. 明確錯誤

| # | 位置 | 問題 | 處置 |
|---|---|---|---|
| A1 | [architecture.md](architecture.md) §5、參考 | 稱 Mermaid fence 由「Astro 的 Sätteri mdast/hast plugin」辨識。查無此 API；Astro 的 Markdown 管線是 unified 底下的 remark/rehype | 改為 `markdown.remarkPlugins`／`rehypePlugins`，並註明沒有其他官方 hook |
| A2 | [deployment.md](deployment.md) §1、§3 | `canonicalRoot = new URL(BASE_URL, site)` 在 `BASE_URL` 無尾斜線時，會讓 `posts/x/` 解析成 `https://host/posts/x/`——base 靜默消失 | 改為 `ensureTrailingSlash` 單一入口，補上 M2 的尾斜線 assertion 與「`/self_blog/` 恰好出現一次」檢查 |
| A3 | [review-checklist.md](review-checklist.md) §5 | sign-off 要填 `plan_commit_sha`，但 `docs/` 當時是 untracked | 註明先 commit `docs/plan/` 再簽核 |

A2 值得多說一句：那個寫法產生的是語法合法、肉眼正常、只有部署到 project site 之後才會 404 的 URL。這類錯誤不會在本機 `astro dev` 被發現，因此檢查必須寫成 assertion，不能靠 code review。

### B. 規格缺口

| # | 缺口 | 處置 |
|---|---|---|
| B1 | 逐項 byte budget 可被組合繞過（5 張合規圖 = 破 1 MB）；且量測 fixture 寫的是「含 code/圖片/流程圖」，budget 列寫的卻是「純文字文章」，兩者對不上 | [architecture.md](architecture.md) §7 改為三個 fixture，新增「重量級文章 total transfer」上限（數值後由 D11 定案為 400 KiB / 12 requests） |
| B2 | 文件出現五個 npm script 名稱與四個 `scripts/*.mjs`，兩者從未對照；「唯一品質入口 `npm run verify`」的組成未定義，導致「PR run 只有 verify」範圍不明 | [architecture.md](architecture.md) §8 新增 npm script 對照表，並規定「沒有接進 `verify` 的檢查不算存在」 |
| B3 | `verify-workflow-snapshot.mjs` 只出現在 workflow-import，architecture 的結構樹漏列 | 補上 |
| B4 | 繁中站，但排版指標整份沿用拉丁預設：`65–75 字元`、未指定中文字型堆疊、未提 `lang`／RSS `language`／CJK 斷行 | [architecture.md](architecture.md) §6 新增「中文排版」小節；M4/M5 加對應 Done when |
| B5 | 全文沒提 `prefers-color-scheme`。0-JS + build-time theme 的寫法等於強制所有讀者深色 | §6 新增「配色偏好」：每個 theme pack 同時定義 light/dark，純 CSS media query，無切換器 |
| B6 | MVP 宣稱含 OG、M5 要對 OG image 斷言，但 `public/` 只有 `favicon.svg`，且多數平台不解析 SVG | 改為**不輸出 `og:image`**（見第二節 D12）；OG 只有 title/description/url/type/locale |
| B7 | Astro 資產目錄是底線開頭的 `_astro/`，Pages 最經典的 404 來源，未討論 | [deployment.md](deployment.md) §4 說明 `deploy-pages` 不跑 Jekyll，並要求 smoke test 實際請求一個 `_astro/*.css` 取得 200 |
| B8 | M0 要求 dependency tree inventory，但本輪禁止安裝套件——要解析 transitive tree 必須先產生 lockfile | [milestones.md](milestones.md) M0 註明在 repo 外拋棄式目錄執行，只帶回報告 |

### C. 綁在註定作廢的 commit 上的斷言

原文斷言「共 9 個反向 `AGENTS.md` link：5 個在 `wf/*.md`、4 個在巢狀文件」，並記錄合併片段在 lines 3–9 / line 7。

但整份規劃的前提就是 `7e7d20b` 不可用、必須改 pin 一個補了 LICENSE 的新 commit。這些常數屆時很可能不成立，而 M1 validator 若寫死 9 會直接誤判。

處置：[workflow-import.md](workflow-import.md) §3 改為「validator 自行列舉，通過條件是零個未改寫的反向連結」；行號標註降級為「僅供定位」；[milestones.md](milestones.md) M1 加上「不比對預期數量常數」。

### D. 風險與比例

- **profile A 幾乎等於換技術棧**：Astro 全樹與任何 build-time Mermaid renderer 必然混有 Apache-2.0／ISC／BSD，headless browser 更是。已在 [licensing.md](licensing.md) §2 寫明 A 與 B 不是對稱的二選一。
- **build job 只給 `pages: read`**：方向正確（官方 starter 給的是 `pages: write`），但屬未經實測的收斂。已在 [deployment.md](deployment.md) §4 寫明失敗時的處置順序，並禁止在 deploy job 之外加 `id-token: write`。
- **verify 不得寫死 base**：CI 由 `configure-pages` 覆蓋 base，檢查若自行寫死 `/self_blog/`，兩邊分歧時 verify 會變成假證據。已在 §1 補上規則。
- [milestones.md](milestones.md) 風險表新增三列：base 尾斜線、budget 組合繞過、中文排版。

---

## 二、R1 決策記錄（2026-08-17，已結案）

| ID | 決策 | 說明 |
|---|---|---|
| D9 | **要做 light/dark** | 每個 theme pack 兩組 token、`prefers-color-scheme` 切換、無切換器。代價是 `miku-cyber` 工作量近乎翻倍、screenshot 從兩組變四組，已接受 |
| D10 | 沿用 35–45 全形字 | 屋主表示無偏好，採預設值 |
| D11 | total transfer 收緊到 **≤ 400 KiB、≤ 12 requests** | 原本的 600 KiB 是假設有 cover + 兩張圖；砍掉 cover 後重算為「HTML + CSS + 1 張截圖 + 1 張 SVG」 |
| D12 | **有截圖，沒有美術素材** | 見下 |
| D13 | **圖片與文章分開放，但同 repo**：來源 `media/<slug>/`，輸出 `dist/images/<slug>/` | 見下 |

### D12 的界線

屋主的原話是「寫文章的時候需要有圖片，就這樣而已」，以及「miku 只是配色風格」。所以切法是：

**留下**——技術截圖的能力、alt 強制、width/height、lazy loading。這是需求驅動的：只有真的需要的文章才有圖，多數文章一張都沒有。（檔案放在哪裡由 D13 決定，見下。）

**砍掉**——`cover`／`coverAlt` frontmatter、列表縮圖、`public/og-default.png`、`og:image`、任何裝飾或角色圖像。

理由是這兩類東西的性質不同。`cover` 是**設計義務**：每篇都想要一張、列表沒有就看起來壞掉、於是逼你持續產出美術素材——那正是屋主不要的東西。截圖是**需求驅動**：技術文章遲早會需要貼終端機輸出或設定畫面，而保留這個能力現在幾乎沒成本，事後補回來卻要重動 schema 與 M3。

既然沒有 cover 也沒有裝飾圖，首頁與純文字文章根本不會發出任何圖片 request，首頁 budget 因此從 200 KiB／12 requests 收到 120 KiB／8 requests，並加上「0 圖片 request」的斷言。

沒有 `og:image` 的社群分享卡片會是純文字樣式。這是刻意的：沒有圖，比放一張湊數的圖好。

### D13：圖片與文章分開放，但同 repo

屋主的要求是「文章內只留圖片連結，具體圖片存在其他地方」，隨後自己提出「還是說同 repo 下的另一個資料夾」。

**採後者。** 我一開始推薦外部 asset repo，理由是 git 歷史——圖片一旦 commit 就永久留著、刪不乾淨。這個顧慮我權重放太高了：本站沒有 cover、沒有裝飾圖，多數文章零張圖，那個量級下 repo 大小不會是瓶頸。外部 repo 換來的是 build 依賴外部可用性、多一個要維護的 repo、授權邊界要另外聲明——不划算。

最終方案：圖片來源放頂層 `media/<slug>/`，文章寫 `![alt](/images/<slug>/shot.webp)`，build step 只把公開文章實際引用到的檔案複製進 `dist/images/<slug>/`。

- 對作者而言就是一條乾淨連結，圖片管理與寫作分離，滿足原始需求。
- `/images/...` 是 logical root URL，[deployment.md](deployment.md#2-url-contract) 既有的 BASE_URL transformer 已經會處理，不用新機制。
- build 不需連網、來源不會掛掉、圖文同一個 commit、授權由根 `LICENSE` 涵蓋。

**為什麼來源目錄不是 `public/images/`**——這是我第一版寫的位置，但它有個會安靜出事的缺陷：`public/` 是**原樣複製**進 `dist/`，所以 draft 文章的截圖會跟著部署出去，直接違反 M3 已經寫死的「production `dist/` 找不到 draft 的任何 asset」。改成「來源目錄 + 只複製被引用的檔案」之後，draft 圖片天然不進 artifact，孤兒檔案也順帶被擋下，不需要維護排除清單。

也不用 `src/assets/`：它能拿到 Astro 的 responsive variants，但從 `src/content/posts/<year>/<slug>/index.md` 引用要寫成 `../../../../assets/...`，與「只留一條乾淨連結」衝突。

因為不過 Astro 圖片管線，失去的東西用一個 rehype plugin 補回來——檔案就在本地，全是確定性操作：讀出實際尺寸注入 width/height（保住 CLS ≤ 0.1）、加 `loading="lazy"`、對缺檔／超標／空 alt 讓 build 失敗。真正失去的只有多尺寸 `srcset`，對截圖而言一張尺寸合宜的 WebP 就夠。

**兩個要記住的副作用**：來源檔就是讀者下載的檔案，所以 gate 必須設在入口（單檔 ≤ 200 KiB、最長邊 ≤ 1600px）；輸出檔名不帶 content hash，所以不宣告 immutable caching，換圖時要換檔名。兩者都已寫進 [architecture.md](architecture.md#4-圖片) §4 與風險表。

---

## 三、刻意不改的部分

以下是我認為做得好、動了反而變差的設計，列出來避免後續被「順手簡化」掉：

- **`getPublishedPosts()` 作為唯一投影來源**，並要求三組 `getStaticPaths()` 與獨立 route inventory 逐項相等。這是整份規劃最強的一條，直接消滅了靜態站最常見的一類 bug（列表看得到、route 不存在，或反之）。
- **0-JS gate 不只看 network request**，還解析 HTML/SVG 拒絕 `<script>`、`on*=`、`javascript:`。「沒有外部 request」確實不能代替這項。
- **robots.txt 的判斷**：project site 無法提供 origin 根的 robots.txt，所以直接不宣稱，而不是放一個沒有效力的檔案。
- **`rg` 退出碼三態解讀**（1 = 無命中通過、0 = 有殘留、≥2 = 檢查故障）。沒有落入「grep 沒找到就當成功」的陷阱。
- **日期驗證**：要求加引號、曆法往返檢查、禁用 runner 時區分月。`2026-02-30` 的案例抓得很準。
- **workflows 授權 gate**。兩個 repo 同屬一人，形式上確實可以直接複製；但把「權利人補 LICENSE → pin 新 commit → 逐位元保存 notice」寫成硬 gate，代價很小而且一次做對。維持原判。

---

## 四、修改後的建議 verdict

`Changes requested` 維持不變，blocking 清單現在只剩兩項外部 gate：

1. workflows upstream 補足 scope 足夠的 MIT LICENSE 並 pin 新 SHA。
2. 依所選 profile 完成 dependency tree 可行性 inventory。

A、B、C 三組已在 R1 修正；D9–D13 已由屋主拍板並回填 [review-checklist.md](review-checklist.md) §3。剩下的收尾動作是把 `docs/plan/` commit 起來以取得 `plan_commit_sha`。

---

## 五、交接給實作者

以下是規格以外的實作邊界。現行規格以 [README](README.md) 與其連結文件為準。

> 本節寫於 R2 審查之前。**大方向仍然有效，但遇到與 [第六節 F 段](#f-接手的人從這裡開始)
> 衝突的細節，以 F 段為準**——那裡是經過 R2 與回覆裁決後的最新版本。

### 1. 先清掉已作廢的供應鏈，再建立網站

Mermaid spike 已完成它的研究目的，但 [ADR-0002](adr/0002-hugo-no-npm.md) 決定
正式網站不使用它。先用一個獨立 cleanup commit 把 spike 從現行工作樹移除；Git
歷史仍保存原始證據。這一筆不能和 Hugo 功能混在一起。

Hugo 必須使用官方 `v0.165.0` standard artifact，先驗 checksum 再執行。不要使用
package manager、`latest`、extended、theme、遠端 Hugo module 或 npm。

### 2. 安裝當下先證明三個 Hugo 行為

不要把文件或記憶當成完成證據。第一個 Hugo gate 要以最小 fixture 實測：

| 斷言 | 賭錯的後果 |
|---|---|
| `.RelPermalink` 與 CSS resource URL 在 production build 都只含一次 `/self_blog/` | 本機正常、Pages 資產 404 |
| production 不 render draft，且未被公開內容引用的 global image resource 不進 `public/` | 草稿文字或圖片外洩 |
| Markdown image render hook 能把作者寫的 `images/<post>/...` logical resource path 解析成帶 project base 的 URL | 所有文章截圖在 Pages 失效 |

gate commit 只加入 fixture、驗證器與明確的 red evidence；下一個 commit 才加入讓它
轉綠的 Hugo config／template。不要在同一筆 commit 改 gate 與被測功能。

### 3. 使用 Hugo 原生內容模型

不要重建一套 content collection 或 taxonomy：文章使用 Hugo 的 `date`、`lastmod`、
`draft`、`tags`（以及需要時的原生 `categories`）；tag/category routes 由 Hugo 產生。
`/archive/` 只以 `GroupByDate "2006-01"` 顯示月份分組與錨點，不建立 month taxonomy，
也不先做 `/archive/YYYY/MM/` routes。

一般資訊頁同樣是 Markdown。新增 About／Contact 不應要求修改 layout registry。

### 4. 圖片只走 Hugo resource 與 render hook

圖片來源維持和文章分離的 `media/<post-slug>/`，以本機 filesystem mount 映射為
global resources；禁止 remote resource。檔案 gate 與 render hook 必須在輸出 URL 前驗證
來源存在、alt 非空、尺寸及檔案大小，並輸出 width、height、lazy loading。只有呼叫
`.RelPermalink` 的公開引用才發布，因此 draft-only 與 orphan 圖片都不應進 artifact。

### 5. 作者只有兩個正式入口

- 預覽：執行一個 PowerShell command，啟動含 draft 的本機 Hugo server。
- 發布：執行一個 PowerShell command，驗證內容與 production artifact，只 stage
  `content/`、`media/` 內明確允許的變更，建立 commit 並 push；main workflow 再以同一
  gate 重建並部署。腳本不得 stage 其他 working-tree 變更，也不得提交 `public/`。

最終 `docs/AUTHORING.md` 必須真的走過這兩條路徑後才可宣稱完成。

### 6. 不能放寬的四條骨架

- production artifact 是普通 HTML、CSS 與被引用圖片，client JavaScript 為 0。
- `baseURL` 含 `/self_blog/` 尾斜線；站內 URL 只能經 Hugo URL API 產生。
- draft 的內容與素材完全不進 `public/`。
- gate 先於功能；需要放寬 contract 時先寫 ADR，不能順手改 validator。

這是一個小型個人 blog。先用 Hugo 原生功能完成文章、taxonomy、月份 archive、一般
頁面與圖片；不要為了「可能以後需要」加入 plugin、client search、流程圖或 framework。

---

## 六、R2 審查（Hugo 轉向後）

審查日期：2026-08-17
審查對象：`febc67d` 當下的 `docs/plan/`、`adr/`、`spikes/`
審查結論：轉向 Hugo 合理，執行品質高。R2 原本提出三處 Hugo API 事實錯誤，**經
[回覆文件](OPUS_ADVICE_REPLY.md) 與官方文件裁決後只有一處成立（A6）**；另有一個第二次發布
必定失敗的 bug（B9）與四項改善建議，全部已有裁決。

### 現行狀態（給接手的人）

| 項目 | 裁決 | 規格是否已改 |
|---|---|---|
| A4 `locale`／`languageCode` | 我誤判，回覆正確 | ✅ 已還原為 `locale` |
| A5 `reflect.IsImageResourceWithMeta` | 我誤判，回覆正確 | ✅ 已還原使用該 helper |
| A6 template layout | 成立 | ✅ §7 已改新結構 |
| B9 三個 ignore 目錄 | 成立 | ✅ 規格已改；`.gitignore` 檔案本身尚未建立 |
| B10 archive budget | 接受（回覆版本更好） | ✅ 已同步並新增 ADR-0003 |
| B11 Linux checksum 證據 | 接受 | ✅ 已同步 manifest／runtime 證據邊界 |
| B12 dirty file 隔離 | 接受（回覆版本更好） | ✅ 已同步 candidate tree／selected snapshot contract |
| C1 流程圖 | 使用者已拍板不納入 MVP | ✅ ADR-0002 已改為範圍決策 |
| C2 CI matrix | 接受 | ✅ 已同步 Ubuntu full／Windows subset |
| D 小項目 | 接受 | ✅ 正式規格已同步；實際 cleanup 留在第 2 步 |

裁決已依 [OPUS_ADVICE_REPLY.md](OPUS_ADVICE_REPLY.md) 同步進正式規格；本節保留原始論述
只是為了讓後人看得到理由。實際 cleanup、gate 與 Hugo 功能仍必須依 F 段分開 commit。

### 先講做得好的部分

不是客套，是為了避免後續被「順手簡化」掉：

- **把 workflows blocker 與 site work 解耦**了。R1 交接的第 1 點就是這個，[review-checklist](review-checklist.md) §3 不只照做，還把 verdict 邏輯改對：site plan 可以 `Accepted`，`workflow_import` 獨立維持 `Deferred/Blocked`。
- **改用 Hugo 原生 taxonomy，刪掉了整套自訂 slug 機制。** R1 花了很大篇幅在 Unicode NFC、`/^[\p{L}\p{N}]+...$/u`、percent-encoding 碰撞——那些複雜度現在整段消失，交給 Hugo。這是真正的簡化，不是搬移。
- **budget 重算過而不是抄過來**：移除 Mermaid 後 total transfer 從 400 KiB 收到 300 KiB（HTML 40 + CSS 24 + 圖 200），數字對得上。
- **gate-first 與 commit separation** 進了 [review-checklist](review-checklist.md) §4，而且 [ADR-0002](adr/0002-hugo-no-npm.md) 明文禁止把 cleanup 與新功能混在同一 commit。
- **保留 R1 第一至四節作為歷史**並加轉向說明，而不是覆蓋。這樣後人看得到決策脈絡。

### A. 事實爭議（已於 2026-08-17 以官方文件裁決）

> **A4 與 A5 我判斷錯誤，[回覆文件](OPUS_ADVICE_REPLY.md)是對的。** 我依 WebFetch 取得
> gohugo.io 現行文件後已把規格改回原樣。以下保留完整記錄，因為錯誤的來源本身值得記著。

| # | 我的主張 | 裁決 | 依據 |
|---|---|---|---|
| A4 | `locale` 不是 Hugo 設定鍵，應用 `languageCode` | **駁回——我錯了** | [Configure languages](https://gohugo.io/configuration/languages/) 明載 `languageCode`「Deprecated in v0.158.0. Use `locale` instead.」。`locale` 才是現行鍵 |
| A5 | `reflect.IsImageResourceWithMeta` 不存在，`reflect` 只有 `IsMap`／`IsSlice` | **駁回——我錯了** | [官方函式頁](https://gohugo.io/functions/reflect/isimageresourcewithmeta/) 存在，標示「New in v0.157.0」，用途正是判斷能否取得 image dimensions 與 metadata |
| A6 | layout 樹混用 0.146 前後兩套慣例 | **成立** | [New template system](https://gohugo.io/templates/new-templatesystem-overview/)：v0.146.0 起 `partials/`→`_partials/`、render hook 進 `_markup/`、kind 直接命名為 `home`／`page`／`section`／`taxonomy`／`term`。已一併確認我寫進 §7 的新樹是對的 |

**為什麼我會錯。** 兩處都是 Hugo v0.157／v0.158 的變更，落在我的知識截止之後；我拿長年穩定的
舊 Hugo 慣例當成現況，還把「這個名字不像 Hugo 風格」的直覺當成證據。`reflect` namespace
歷來確實只做型別判斷，`IsImageResourceWithMeta` 讀起來不像屬於那裡——但那是品味，不是事實。

**這件事本身就是 R1 交接第 2 點的實例**，只是主角換成我：*版本相依的斷言不要相信文件、
不要相信記憶，也不要相信任何 AI——去實測*。分歧發生時，正確的動作是抓官方文件或跑一次
binary，而不是比較兩邊語氣的自信程度。這條原則對 reviewer 和 implementer 一體適用。

A6 成立的部分，失敗方式仍是**安靜的**：套錯 layout 位置不會報錯，只會讓 Hugo 悄悄退回預設
模板。回覆文件要求「為每個 page kind、render hook 與 RSS template 放 sentinel，斷言 artifact
真的來自預期 template，而不只是 build 沒報錯」——這比我原本的寫法更嚴，採納。

### B. 會在真實使用中咬人的問題

**B9 ✅：第二次發布一定失敗。**

[deployment.md](deployment.md) §5 的 validation build 會產生 `.hugo-validation/` 目錄，Hugo 另外還會產生 `resources/`。但 §8 的 `publish.ps1` 第 3 步是「拒絕已 staged 或 unstaged 的任何選取集合外變更」，而第 4 步才跑 validation build。

於是：第一次執行時工作樹乾淨，通過；跑完留下 `.hugo-validation/`。**第二次執行時，第 3 步就會撞到這個未追蹤目錄而拒絕發布**，而且錯誤訊息會指向一個作者根本沒碰過的目錄。

[milestones.md](milestones.md) M0 的 ignore policy 只列了 `public/`、`resources/`，漏了 `.hugo-validation/`。修法很簡單——三個目錄一起進 `.gitignore`，而且要在第一次跑 `hugo` 之前就進去，不是之後。

**B10：`/archive/` 現在是唯一無上限成長的頁面，卻沒有 budget。**

轉向後 `/archive/YYYY/MM/` 獨立頁改成單一頁面加 `YYYY-MM` anchor。這個簡化本身可以接受（anchor 一樣可直達、可分享），但它有個副作用沒被處理：

- `/posts/` 有 pagination 保護（20 篇啟用）。
- `/archive/` 明文不分頁，所以它會隨文章數線性成長，永遠。
- 而 [architecture.md](architecture.md) §6 的 budget 表只有首頁與文章頁兩種 fixture，**沒有任何一列在管 `/archive/`**。

原方案的月份分頁天然把這個成長切碎了；新方案把成長集中到一頁，卻沒有補上對應的 gate。建議加一列「archive 頁 total transfer」，或明訂超過 N 篇後改回月份頁。

> **裁決（[REPLY](OPUS_ADVICE_REPLY.md) §6）：接受，且只採 budget 一半。** archive 首載
> HTML + CSS + favicon ≤ 120 KiB、≤ 6 requests、0 JS、0 image request；超標 fail closed，
> 屆時另立 ADR 在 static pagination 與月份獨立頁之間選擇。不預先猜「第幾篇會超標」。
> 月份 anchor 的路由決策另記 ADR。

**B11：Linux checksum 沒有證據，而 Linux 才是實際部署的那個。**

[ADR-0002](adr/0002-hugo-no-npm.md) 固定了兩個 SHA-256，但「版本可行性證據」那段只寫了 **Windows amd64** 的驗證結果。CI 的 Ubuntu deploy path 用的是 Linux amd64——也就是說，唯一產出正式 artifact 的平台，其 checksum 是未經證實的。

失敗模式是 fail-closed（對不上就擋下），所以不危險，但會在第一次 CI run 才爆，而且長得像供應鏈攻擊。先從官方 `checksums.txt` 補一次 Linux 的驗證記錄，成本兩分鐘。

> **裁決（[REPLY](OPUS_ADVICE_REPLY.md) §7）：接受。** 官方 manifest 的兩筆 exact entry 已記為
> 規劃證據，並誠實聲明「不假裝 Linux binary 已在 Windows 環境執行過」。第一個 Ubuntu gate
> 仍須下載 exact artifact、比對 SHA-256，再要求 `hugo version` 回報 `v0.165.0`、`linux/amd64`
> 與 standard edition。

**B12：`publish.ps1` 拒絕「執行」而不是拒絕「stage」。**

安全性質應該是「絕不 stage 選定集合以外的東西」，這點做得對。但目前規格是有任何無關的髒檔案就整個拒跑。對一個人的 blog，「一邊調 CSS 一邊寫文章」是日常狀態，這會變成三天兩頭被自己的工具擋住。

建議把兩件事分開：無關的 dirty path **不阻止發布**，只是絕不進 staging，並在 diff 確認畫面明列「以下變更本次不會提交」。真正該硬擋的是 `public/` 被 tracked、staged 集合與 allowlist 不符、以及驗證失敗。

> **裁決（[REPLY](OPUS_ADVICE_REPLY.md) §8）：接受，並收得比我提的更緊——這是對的。**
> 只「不阻擋」還不夠：若本機未提交的 CSS 參與了 validation build，而 commit 只含文章，
> 本機驗證與 CI 實際建置的內容會分歧。最終 contract 是：unstaged／untracked 的無關變更
> 不阻擋但明列排除；**選定集合以外若已 staged 則 hard fail**；驗證在隔離的 selected
> snapshot（`HEAD` + 本次 content unit + owned media）進行，不讀工作樹其他未提交變更。

> **後續正式規格再收緊：**起始 index 必須完全乾淨；temporary index 產生 candidate tree，
> real index 與 commit tree ID 都必須等於已驗證 tree。上述「只有集合外 staged 才失敗」保留
> 作為審查歷史，不是現行 contract。

### C. 需要你拍板的範圍問題

**C1：流程圖被移除了，而那是你最初列的需求之一。**

[ADR-0002](adr/0002-hugo-no-npm.md) 的理由是「不是必要功能，且會重新引入 npm／browser 依賴」。前半是你的判斷，我不反對；但**後半的推論有漏洞**：

> 限制是「不要 npm」，不是「不要圖表」。

D2 與 Graphviz 都是**單一原生 binary**，沒有 npm、沒有 Node、沒有 headless browser。而這個專案已經接受了「下載固定版本 binary + 驗 checksum」這個模式（Hugo 就是這樣來的）。所以要保住流程圖，代價是**在既有 PowerShell pipeline 裡多一個 pinned binary**，把 `.d2`／`.dot` 在 build 前渲染成 SVG——不是把整棵 npm 樹請回來。

ADR 的「未採方案」只列了 Astro+npm 和 Mermaid production renderer，沒有評估過原生 binary 這條路。如果你其實想要流程圖，這是最便宜的復原方式；如果你確實不要了，那也沒問題，但理由應該寫成「不需要」而不是「做不到」。

順帶一提：Mermaid spike 已經寫了約 2000 行並證明可行，現在要整包刪掉。這不是浪費（它回答了問題），但確認一下你真的不要，再刪。

> **裁決（[REPLY](OPUS_ADVICE_REPLY.md) §9）：使用者已拍板不納入 MVP，措辭也改對了。**
> 理由是「目前的一般 blog 需求不需要，且每多一個 renderer 就多一組版本／checksum／授權／
> SVG 安全維護面」，並明確聲明**不宣稱**原生 binary 方案不可行。D2／Graphviz 留待未來真有
> 需求時另立 enhancement ADR 比較。Mermaid spike 依原計畫由獨立 cleanup commit 移出工作樹。

**C2：Windows + Ubuntu 全套 CI matrix，對一個個人 blog 偏重。**

正式 artifact 只由 Ubuntu 產生，Windows matrix 保護的是你本機的作者流程。這值得測，但不必用「同一批完整 gate 跑兩遍」的方式——效能與 smoke test 在 Windows runner 上更慢也更容易 flaky。建議 Ubuntu 跑完整 gate、Windows 只跑作者流程相關的子集。這是整個計畫裡最容易 descope 的一塊。

> **裁決（[REPLY](OPUS_ADVICE_REPLY.md) §10）：接受。** Ubuntu 跑完整 gate 與 Pages
> deploy path；Windows 只跑 checksum/version、腳本解析、path normalization、content-unit
> selection、staging allowlist 與最小 smoke fixture，不重跑效能量測、部署或完整站點 smoke。
> 兩邊仍共用同一份 `publish.ps1`，不維護第二套 Bash 實作。

### D. 小問題

- **repo 現在與自己的計畫矛盾**：`spikes/mermaid-renderer/package-lock.json` 仍被追蹤、`node_modules/` 還躺在磁碟上，而計畫寫「不引入 npm」。cleanup commit 之前，[review-checklist](review-checklist.md) §2 的兩個勾選項對這個 repo 是假的。cleanup 記得連磁碟上的 `node_modules/` 一起清。
- 附帶的流程教訓：R1 的 B8 建議是「可行性驗證在 repo 外的拋棄式目錄做，只帶回報告」。這次改成把整個 spike 提交進 repo，於是現在多了一筆 cleanup 債。結論本身有價值，方式可以更輕。
- 根目錄有一個**空的 `scripts/`**，未被 git 追蹤。無害，但清掉或放進第一個 gate commit。
- [deployment.md](deployment.md) 參考連結 `using-custom-workflows-with-github-actions` 應為 `...-with-github-pages`，現在這條會 404。
- **宣告 `module.mounts` 會取代 Hugo 全部預設 mount**——這點 §4 做對了（assets/content/layouts/static 都補了），但 `data`、`i18n`、`archetypes` 沒列。目前用不到所以沒事，日後要用會安靜失效，值得加一行註解。
- `/archive/` 從月份獨立頁改成 anchor 是可接受的簡化，但它動到了最初「依發布月份尋找」的需求形狀，應該是一筆有記錄的決策，而不是埋在段落裡。

> **裁決（[REPLY](OPUS_ADVICE_REPLY.md) §11）：全部接受。** 參考連結我已直接修正；
> `module.mounts` 的風險會在 `hugo.toml` 旁加註，`data`／`i18n`／`archetypes` 未來啟用時
> 必須同步新增 mount 與 fixture；空 `scripts/` 由第一個 gate commit 自然使用；spike 與其
> `node_modules/` 在 plan sign-off 後由獨立 cleanup commit 移除。月份路由決策另立 ADR。

### E. 回覆中比我原提議更好的三處

記下來，避免日後被當成「reviewer 原意」而改回去：

- **B12**：我提「無關 dirty file 不阻擋、只是不 stage」。回覆指出這不夠——若本機未提交的 CSS 參與了 validation build 而 commit 只含文章，**本機驗證與 CI 實際收到的內容會分歧**。改成在隔離的 selected snapshot 驗證才真正解決。這比我的版本正確。
- **B10**：我提「加 budget，或明訂超過 N 篇改回月份頁」。回覆只採前者並說明理由——要限制的是讀者下載量而不是文章數，猜「第幾篇會超標」本來就不穩定。同意。
- **C1**：理由從「會重新引入 npm」改成「目前不需要，且每多一個 renderer 就多一組維護面」，並明確不宣稱原生 binary 不可行。這正是我要求的方向。

### F. 接手的人從這裡開始

**第 1 步的規格同步內容**：A4／A5 還原、A6 新 layout 樹、B9 三個 ignore 目錄、
B10 archive budget、B11 Linux 證據邊界、B12 candidate tree／selected snapshot、C1 流程圖範圍、C2 CI
分工、D 小項目、GitHub Pages 參考連結與 ADR-0003。這些只屬 plan／ADR／審查文件。

**接下來的順序**，與 [REPLY §12](OPUS_ADVICE_REPLY.md) 一致，我沒有異議：

1. **本次 plan-only commit**：把 B10／B11／B12／C1／C2／D 的裁決同步進正式規格，連同
   回覆文件一起提交並取得新的 plan commit SHA。這一步只改文件。
2. **獨立 cleanup commit**：移除 `spikes/mermaid-renderer/` 的工作樹檔案與磁碟上的
   `node_modules/`，同時建立 `.gitignore`（`/public/`、`/resources/`、`/.hugo-validation/`）。
   Git 歷史保留 spike 證據。
3. **獨立 gate commit**：加入 Hugo checksum、template lookup sentinel、content／image、base、
   archive budget、publish isolation 與 0-JS 的**負向** fixture，先證明錯誤輸入會被擋下。
4. 下一個 commit 才加入 Hugo 最小垂直切片，讓既有 gate 轉綠。

第 2 步的 `.gitignore` 必須在**第一次執行 `hugo` 之前**就存在，否則 build 產物會先混進
工作樹、污染排除清單並增加誤 stage 的風險。

**第 3 步要特別測的三件事**，都是「不會報錯、只會安靜給錯結果」那一類：

- template lookup：為每個會用到的 page kind、render hook 與 RSS template 放 sentinel，斷言
  artifact 真的來自預期 template，而不只是 build 沒報錯。
- 語言輸出：斷言生成的 `<html lang="zh-Hant-TW">`、RSS `<language>` 與 og:locale 字串本身，
  不是斷言 `hugo.toml` 寫了什麼。
- Linux checksum：在 Ubuntu gate 實際下載、比對 SHA-256，再要求 `hugo version` 回報
  `v0.165.0`、`linux/amd64`、standard。

**最後一句，這輪最該記住的教訓**：這次 R2 提出的三個「事實錯誤」有兩個是我自己記錯的，
因為 Hugo 在 v0.157／v0.158 改了 API 而我拿舊慣例當現況。版本相依的事情，**不要相信任何
一方的記憶——包括 reviewer 的**。有分歧就抓官方文件或跑一次 binary，用證據結案，不要用
語氣的自信程度結案。
