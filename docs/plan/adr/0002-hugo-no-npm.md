# ADR-0002：採用 Hugo standard、移除 npm 與 production Mermaid

- 狀態：Accepted
- 日期：2026-08-17
- 範圍：正式網站建置與部署
- 依據：[授權與供應鏈規劃](../licensing.md)、[架構](../architecture.md)

## 背景

本網站的目標是輕量、零訪客 JavaScript，以及盡量小的 build-time 供應鏈。Astro／npm／Mermaid spike 雖能完成需求，但會帶入大型 transitive dependency tree；流程圖也不是必要功能。Hugo 能在 build-time 將 Markdown 產生普通 HTML，且不需要 npm。

## 決策

1. 正式網站使用 Hugo `v0.165.0` standard binary，不使用 extended 或 withdeploy 版本。
2. Linux amd64 checksum 固定為 `5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432`；Windows amd64 checksum 固定為 `bdd9cc7837a42389067b2d0df7858d5878ceddef21307c2dd27fa10885fbbcf9`。實作時必從官方 release `checksums.txt` 驗證，並檢查 exact `hugo version`。
3. 正式網站不引入或依賴 npm、package lock、Hugo themes、遠端 modules、git submodules
   或 remote resources，只使用自有 layouts、content、assets、static、data 與 CSS。
   現有 Mermaid spike 是前一方案的歷史研究，須在第一個 Hugo 功能前以獨立 cleanup
   commit 將整個 `spikes/mermaid-renderer/`、其 lockfile 與磁碟上的 `node_modules/` 移出
   工作樹；cleanup 不得與 gate 或 Hugo 功能混在同一 commit。在此之前任何正式
   build／CI／publish command 都不得安裝或執行它。
4. Hugo binary 僅供本機／CI build-time 使用，不進入 repo 的 Pages artifact，因此不重新散布 binary；Hugo 的上游授權仍記錄為 Apache-2.0，與 repo 自有內容的 MIT 邊界分開。
5. GitHub Pages 使用官方 Actions，但實作時所有 `uses:` 必須固定完整 commit SHA；在凍結前核對 exact tag、nested actions 與各 nested action 的 license。major tag、branch 與未核准第三方 action 不得使用。
6. 授權採 Profile B：允許 Apache-2.0 等明確的 permissive licenses；unknown、missing、new 或 version-changed dependency fail closed，除非另有獨立 Accepted ADR。不要用不存在的 `NOTICE` 作為 Hugo 授權證據。
7. 本機作者流程支援 Windows amd64 與 Linux amd64，兩者以 PowerShell 7 執行同一份
   verification／publish scripts。CI 由 Ubuntu amd64 跑完整 gate 與 Pages path，Windows
   amd64 只跑作者流程與跨平台語意子集，避免重複效能、部署與完整站點 smoke。
8. MVP 不提供 Mermaid、D2、Graphviz 或其他流程圖 renderer，原因是目前的一般 blog 需求
   不需要它，且每個 renderer 都增加版本、checksum、授權與 SVG 安全維護面；本決策不宣稱
   D2／Graphviz 等 pinned native binary 技術上不可行。未來有實際需求時另立 enhancement ADR。

## ADR precedence

本 ADR 自接受起，supersede [ADR-0001](0001-mermaid-profile-b-evidence.md) 對「正式實作」的 authority。ADR-0001 的 Mermaid renderer、npm dependency 與 license evidence 僅是已完成的 M0 歷史 spike，不是 production dependency，也不應被新的 Hugo implementation 引用為必需品。

未來若要清除 spike 檔案或其依賴，必須另開一個獨立 cleanup commit；不得在本 ADR 或 Hugo 功能 commit 中刪除、改寫 frozen spike gate／fixture，也不得把 cleanup 與新功能混在一起。

## 後果

- build toolchain 由 npm dependency tree 縮減為固定 Hugo binary 與 GitHub Actions。
- Markdown、tags、月份 archive、About／Contact 等頁面在 build-time 產生；訪客不下載 Markdown parser 或 client runtime。
- MVP 不承諾流程圖；文章先用一般圖片或純 Markdown 表達。這是範圍選擇，不是技術不可行的判斷。
- Hugo 的完整編譯依賴授權 inventory 仍需在實作 gate 中完成；本 ADR 不把「只有 Apache」當成未驗證事實。
- workflows upstream license blocker 保留，未解決前不可導入該 snapshot。

## 版本可行性證據

2026-08-17 以官方 Windows amd64 standard artifact 做 repo 外拋棄式驗證：下載檔的
SHA-256 等於本 ADR 固定值，`hugo version` 回報
`v0.165.0-76a5e1880ab46688155b02e99bab9be2a6134492`。最小 site fixture 另證明：

- `.RelPermalink` 在設定的 project `baseURL` 下產生單一 `/self_blog/` prefix；
- production build 不輸出 draft sentinel；
- Hugo 原生 tags 會建立 index／term pages，繁中 term 的連結由 Hugo percent-encode；
- template `.Params` 可讀到原生解析後的 `title`、`description`、`date`、`draft`、`tags`；
  省略 `draft` 時仍得到 boolean `false`，因此 validation partial 不需重寫 YAML parser；
- permalink 的 `:slug` 無 frontmatter slug 時會退回 title，而 `:contentbasename` 才會
  使用文章 leaf bundle 目錄名，因此 posts permalink 固定使用後者；content root 的一般
  頁面則沿用 Hugo 預設檔名路由。

同日另與官方 v0.165.0 `checksums.txt` 核對 Linux amd64 exact entry：

```text
5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432  hugo_0.165.0_linux-amd64.tar.gz
```

這只證明 official manifest 值，不假裝 Linux binary 已在 Windows 執行。第一個 Ubuntu gate
仍須實際下載 archive、比對 SHA-256，並要求 `hugo version` 回報 v0.165.0、linux/amd64、
standard。

這是選型證據，不取代正式 gate；實作仍須先提交 fixture／validator，再由下一筆功能
commit 讓 gate 通過。

## 未採方案

- Astro + npm：可行但供應鏈與 build footprint 超出本網站的優先目標。
- Mermaid production renderer：可行，但 MVP 沒有流程圖需求；既有做法還會帶回 npm／browser
  的版本、授權與安全維護面。
- D2／Graphviz pinned native binary：技術上可行且不需要 npm，但目前沒有使用需求；若未來
  需要流程圖，再與 Mermaid spike 一併用 enhancement ADR 比較。
- 手寫所有文章 HTML：可省略 Markdown parser，但會失去一致的列表、taxonomy、archive、RSS 與 sitemap 生成；保留 Markdown 作為作者來源較實用。

月份 archive 的 route 與 hard budget 另由 [ADR-0003](0003-month-archive.md) 記錄。
