# 規劃審查清單

← [規劃入口](README.md)｜[架構](architecture.md)｜[部署](deployment.md)｜[workflows 導入](workflow-import.md)｜[授權](licensing.md)｜[里程碑](milestones.md)

用途：讓 reviewer 判斷本規劃是否完整、一致且可驗收，能否由 `Proposed` 進入 `Accepted`。
本檔不是在實作前假裝網站已完成；下列 `[ ]` 表示 reviewer 已確認「規格有明確要求與可觀察的
驗收方式」。真正的 build、artifact 與上線 evidence 依 [milestones.md](milestones.md) 在實作時補齊。

## 1. 正式方案與需求

- [ ] [ADR-0002](adr/0002-hugo-no-npm.md) 已被接受，並取代 [ADR-0001](adr/0001-mermaid-profile-b-evidence.md) 對正式實作的 authority；後者只保留歷史 spike 記錄。
- [ ] 正式 build 使用 Hugo `v0.165.0` **Standard**，不是 extended／withdeploy／浮動 tag；使用官方 release `checksums.txt` 驗證 exact binary。
- [ ] 已記錄 Linux amd64 SHA-256：`5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432`；Windows amd64 SHA-256：`bdd9cc7837a42389067b2d0df7858d5878ceddef21307c2dd27fa10885fbbcf9`。
- [ ] Markdown 只在 build-time 轉成 ordinary HTML；Pages artifact 不含 Markdown source、Hugo binary 或 build dependency。
- [ ] 正式網站不引入 npm、Node、package lock、Go module、Hugo theme、遠端 module、git submodule、remote resource 或 client JavaScript；規格要求歷史 Mermaid spike 在第一個 Hugo 功能前由獨立 cleanup commit 移出工作樹，且不得接入 Hugo build／CI／publish command。
- [ ] GitHub Pages project-site URL 與 base 均為 `https://justty32.github.io/self_blog/`；canonical、RSS、sitemap、資產與 404 均正確帶 base。
- [ ] 文章採 Hugo 原生 content model；front matter 使用原生 `title`、`date`、`lastmod`、`draft`、`tags`，可選原生 `categories`，不新增 `publishedAt`、自訂 taxonomy 或 tag slug。
- [ ] draft 的 HTML、route、列表、tag、archive、RSS、sitemap 與圖片完全不進 production artifact。
- [ ] Hugo 原生 tags（及需要時的 categories）具備 taxonomy index／term 靜態頁；`/archive/` 是單一索引頁，以每個 `YYYY-MM` anchor 分組，不另承諾月份 route；term 名稱與 URL normalization 不由自訂 slug validator 取代。
- [ ] `content/<page>.md` 可產生 About／Contact 等一般 Markdown 頁，不需新增 section 或 template registry；作者指南為 `docs/AUTHORING.md`。
- [ ] 圖片僅限 `media/` 的本地技術截圖；無 cover、裝飾圖、角色圖或 `og:image`；只複製公開文章實際引用的檔案。
- [ ] CSS theme 以 semantic tokens 與自有 CSS 實作藍／青綠輕科幻風格；換色不改內容與模板結構，且有 responsive、鍵盤焦點、對比與 reduced-motion evidence。

## 2. 輸出與供應鏈 gate

- [ ] 全部 production HTML／SVG 經 artifact verifier：沒有 `<script>`、event-handler、`javascript:` URL、inline runtime、未核准 remote URL 或第三方 origin request。
- [ ] Pages artifact 只有部署所需的 HTML、CSS、favicon、公開內容圖片與必要文字檔；沒有 source、docs、workflow snapshot、node_modules、source map 或未引用 asset。
- [ ] Hugo binary 只在本機／CI build-time 使用，不進 repo 或 Pages artifact；其 Apache-2.0 與本 repo 自有 MIT 內容的界線已記錄。
- [ ] 所有 GitHub Actions 固定完整 commit SHA，且每個 action、nested dependency 與使用中的第三方素材有 license inventory；unknown／missing license fail closed。
- [ ] CSS、HTML、圖片、單頁總傳輸量與 request budgets 已定義並由同一品質入口驗證；不得以放寬 gate 取代修正輸出。
- [ ] `public/` 明確列入 `.gitignore`；驗證證明 build output 不會被 stage、commit 或 push。
- [ ] Windows amd64 與 Linux amd64 以 PowerShell 7 執行同一品質／發布入口；CI matrix
  驗證大小寫、路徑分隔、換行與 executable bit，沒有只在 Windows 可用的命令。

## 3. workflows 的獨立外部 gate

workflows snapshot 是與 Hugo 網站分開的 deferred workstream。下列 gate 未通過時，只阻擋
workflows 的複製、導入與完成宣告；**不阻擋本規劃被接受，也不阻擋不依賴該 snapshot 的 Hugo
網站實作**。Reviewer 應確認 blocker 被誠實記錄且沒有繞過路徑，不必假裝上游授權已存在。

- [ ] 規格明訂：workflows upstream 必須先加入 scope 足夠的 MIT LICENSE，並產生包含該授權的新完整 commit；目前盤點 commit `7e7d20bb4d30271f8369acad5f85a267d66e9be1` 不可用來導入。
- [ ] 規格要求導入時核對 upstream notice、來源路徑、commit、manifest 與 hash，且結果可回滾、不依賴 `C:\code\mine\workflows` 等本機路徑。
- [ ] workflows 未過 gate 時的狀態固定為 `Deferred/Blocked`；任何 milestone、文件或 CI 都不得宣稱已導入。
- [ ] Hugo、Actions、截圖與其他實際納入網站的第三方輸入，仍須在各自 milestone 完成 license inventory；missing／unknown／未核准例外為零，或有獨立 Accepted ADR。

只有 workflows 子項目的 verdict 會因上述 gate 未成立而維持 `Deferred/Blocked`；site plan reviewer
若發現規格企圖略過 gate，才應給 `Changes requested`。

## 4. Gate-first 與 commit separation

- [ ] 每一個 gate 先於它所保護的功能或資產建立，且先以正確的負向 fixture／canary 證明會失敗。
- [ ] gate 與功能分開 commit：禁止同一 commit 同時修改 verifier／allowlist／budget，及修改後會使該 gate 失敗的程式、內容或 artifact。
- [ ] 若規則真的要放寬，已用獨立 ADR 記錄理由、範圍、風險、替代方案與 reviewer；沒有直接改 allowlist 使紅燈消失。
- [ ] 計畫文件與 ADR 已先獨立提交並記錄 `plan_commit_sha`；只有取得 SHA 後才可進入實作 commit。
- [ ] 實作順序為：先建立 gate → 驗證 gate 會擋錯誤 → 再建立 Hugo 垂直切片 → 分階段加入內容與外觀；每一階段都有獨立 evidence。
- [ ] 一鍵發布流程已可重現：Markdown + `media/` → `pwsh ./scripts/publish.ps1` → verify → 只 stage 明確選定 content unit 與其 owned media 變更（含刪除）的 scoped commit／push → GitHub Actions 用固定 Hugo build／deploy；`public/` 全程不進 git。

## 5. Reviewer decision

| 項目 | 審查結果／證據位置 |
|---|---|
| Hugo exact version／checksum | |
| URL／base contract | |
| content／route／draft contract | |
| 0-JS／artifact gate | |
| workflow upstream license gate | `Deferred/Blocked`，直到新授權 commit 存在 |
| license profile／inventory | |
| gate-first／commit boundaries | |
| author guide／部署證據 | |
| 一鍵 publish／public 不入版控 | |

簽核時填寫：

```text
reviewer:
reviewed_at:
plan_commit_sha:
license_profile: B-permissive | A-strict-MIT-only
custom_domain: none | <decision reference>
verdict: Accepted | Changes requested
workflow_import: Deferred/Blocked | Ready
blocking_findings:
notes:
```

只有需求、文件、決策邊界與驗收設計完整一致，且 `blocking_findings` 為空，才能把
[規劃入口](README.md) 狀態改為 `Accepted` 並開始實作。尚未執行的 milestone evidence 不會阻擋
plan acceptance；它們會阻擋對應 milestone 的完成。workflow 授權未完成時保留
`workflow_import: Deferred/Blocked`，但 site plan 仍可是 `Accepted`。

## 6. 審查時應核對的權威文件

- [Hugo v0.165.0 release](https://github.com/gohugoio/hugo/releases/tag/v0.165.0) 與該 release 的 checksums
- [Hugo license](https://gohugo.io/about/license/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [MIT License（OSI）](https://opensource.org/license/mit)
