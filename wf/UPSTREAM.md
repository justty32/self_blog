# UPSTREAM — workflows 來源與更新

[INDEX](INDEX.md)｜[導入規格](../docs/plan/workflow-import.md)

本快照採非侵入式配置：只有 [AGENTS](../AGENTS.md) 與 [CLAUDE](../CLAUDE.md)
入口位於專案根目錄，工作流內容都在 `wf/`。網站獨立建置，沒有相鄰 repo、
symlink、submodule 或自動更新相依。

## 固定來源

- 核准 remote：`https://github.com/justty32/workflows.git`。
- commit：`368468a0cda612ffeb4d70bb72f39e765ed73327`。
- kernel 標記：v0.6（2026-09-02），含上述 commit 的後續未發布修訂。
- 導入日期：2026-10-27（Asia/Taipei）。
- 根 `LICENSE`：CC0-1.0；[原始全文](LICENSE.workflows-CC0.txt) 逐位元保留。
- 授權 SHA-256：`65d5fc6631d23cc6da9414b5e52f1fd88b6c6d90263b61466c3d93ef00a018b4`。

來源 checkout 在讀取前後均為上述 HEAD，`git status --porcelain=v1` 為空。
只用 `git show <commit>:<path>` 讀取 commit tree，沒有修改來源 checkout。
完整 source blob SHA、目的地、適配與本地 SHA-256 見 [upstream-manifest.json](upstream-manifest.json)。

## 本地適配

保留開發、驗證、環境與繁體中文寫作流程。依現有 Hugo／PowerShell 指令、
GitHub Pages 與專案目錄填寫內容；入口改成相對 `wf/` 路徑；活狀態清空。
CLAUDE 與授權檔逐位元複製，其他文件精簡與適配，派發表只合入已導入項目。

不導入 skills、完整 kernel 工具、inbox、tick、routines、schedule、digest、
plan-a-thing、decide、learn、organize；入口、連結與純文字導流同步移除。
上游已移除的 DEV-GUIDE 由 dev-env 取代。沒有 wf/AGENTS shim。

## 更新程序

1. 記錄來源 remote、HEAD、完整 `git status --porcelain=v1`，核對新 commit 授權範圍。
2. 依 manifest 的 source 清單從新 commit tree 逐檔匯出，不複製 working tree，也不整包導入。
3. 重套本地適配；更新 commit、blob SHA、license 原文與 hash、各檔 SHA-256 和本文件日期。
4. 執行以下獨立離線檢查，檢視 diff；再次記錄來源 HEAD/status，確認來源未變。

```powershell
pwsh -NoProfile -File scripts/verify-workflow-snapshot.ps1
pwsh -NoProfile -File scripts/test-workflow-snapshot.ps1
```

validator 核對本地內容與 manifest，不連網驗證來源 Git 物件。更新時仍需對實際
pinned tree 核對來源。CI 在 Windows／Linux 執行上述檢查，網站建置指令保持獨立。

`SESSION-LOG.md`、`WAIT_USER.md`、`workflows/common/gotchas.md`、
`workflows/common/user.md` 的 manifest `mutable` 為 true；日常更新不需重寫導入
基準 hash，但仍檢查檔案存在、連結與模板殘留。其餘 snapshot 文件修改時同步更新 hash。
manifest 不記自己的 hash。`.gitattributes` 保留跨平台一致的快照 bytes。

更新不自動 commit／push；使用者決定提交時，把 snapshot、provenance 與驗證變更
保留在可獨立回滾的 commit。移除工作流整合時，移除入口、wf、專用檢查及對應 CI 步驟；
網站的 build、內容與發布腳本不需改動。
