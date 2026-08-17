# R1 審查發現與修改記錄

← [規劃入口](README.md)

審查日期：2026-08-17  
審查範圍：`docs/plan/` 全部六份文件（審查時尚未進版控）  
審查結論：同意 [review-checklist.md](review-checklist.md) 的 `Changes requested`，但 blocking 理由不只「workflows 沒授權」一項。

本檔記錄 R1 這一輪的**修正、決策與理由**。

> **這份文件不是規格。** 規格在另外六份文件裡；本檔只保存「為什麼是這樣」。要改計畫請改那六份，不要把這裡當 source of truth，也不要讓兩邊分歧。
>
> 接手實作的人請直接看 [第五節「交接給實作者」](#五交接給實作者)。

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

以下是規格本身沒寫、但接手的人應該先知道的事。

### 1. M1 與 M2 可以對調

[milestones.md](milestones.md) 把 workflows snapshot（M1）排在 Astro 骨架（M2）之前，但 **M2 完全不依賴 workflows 授權**。如果想現在就開始寫程式，不必等上游補 LICENSE：先做 M2/M3，M1 等 gate 過了再插進來。

只有一個順序限制要守住：M1 的 `AGENTS.md` 只能引用當時已存在的 verifier，改成 `npm run verify` 必須和建立 npm scripts 在同一個 commit。

### 2. 三個版本相依的斷言，安裝當下要實測

計畫在這三處依賴特定 Astro 行為。**不要相信文件，也不要相信 AI 的記憶**，用實際安裝的版本跑一次：

| 斷言 | 位置 | 賭錯的後果 |
|---|---|---|
| `BASE_URL` 帶尾斜線 | [deployment.md](deployment.md#3-canonicalrss-與-sitemap) §1、§3 | canonical/RSS/sitemap 靜默丟掉 base，只有部署後才 404 |
| glob loader 支援 `deferRender` | [architecture.md](architecture.md) §2 | draft 會被預先 render，asset 外洩到 artifact |
| `markdown.syntaxHighlight.excludeLangs` | [architecture.md](architecture.md) §5 | Mermaid fence 先被 highlighter 改寫，plugin 抓不到 |

第一項最重要——它是 R1 修掉的 A2 那個 bug 的根源。規格已經要求把它寫成 assertion，請**先寫 assertion 再寫功能**。

### 3. Mermaid renderer 是最大的未知數

它被推遲到 M0 決定，但 build-time 產 SVG 通常要拉 headless Chromium。CI 時間、穩定性、以及 license profile A 的可行性全部卡在這裡。

**建議第一件事就做這塊的 spike**，不要等到 M3 才發現選型錯誤——那時候 frontmatter、route 與 budget 都已經蓋在上面了。

### 4. 圖片的 rehype plugin 沒有實作驗證

D13 的「讀本地檔、注入 width/height、超標就 fail」概念上直接，但它是整份計畫裡唯一一段沒有現成慣例可抄的機制。預留除錯時間，並且記得它同時扛著三個保證：CLS、byte budget、draft asset 排除。

### 5. 最需要防的失敗模式：改 gate 而不是改程式

這份計畫有大量「這種情況就讓 build 失敗」的規則。實作時撞到紅燈，最省事的做法永遠是把檢查放寬——而放寬之後沒有人會發現保證已經不成立了。

硬規矩兩條：

1. **gate 要在它所守護的功能之前先寫好。**
2. **永遠不准在同一個 commit 裡同時改 gate 和讓它失敗的程式。**

真的需要放寬時，走 ADR，不要改 validator 的 allowlist 了事。

### 6. 可以砍的與不能動的

進度落後時，**可以 descope**：靜態分頁、`plain` theme、Lighthouse 分數目標、RSS。砍掉請明說並更新 Done when，不要靜默跳過。

**不能動**的是四條互相支撐的骨架：

- `getPublishedPosts()` 作為公開內容的單一投影來源
- 0-JS gate（含 HTML/SVG 解析，不只算 network request）
- base 尾斜線與「`/self_blog/` 恰好一次」
- draft 的內容與 asset 完全不進 artifact

少任何一條，產生的 bug 都是「本機正常、部署後才看得到」的那一類。

### 7. 關於這份計畫的重量

對一個個人 blog 來說偏重，這點無須否認。但重的地方都重在**驗證**而不是**功能**——MVP 的功能面其實很小。這個比例是刻意的：功能少而確定，好過功能多而不知道有沒有壞。

如果接手的人想簡化，請優先簡化功能範圍，不要優先簡化驗證。
