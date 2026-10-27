# workflows 非侵入式導入

← [規劃入口](README.md)｜[授權](licensing.md)｜[里程碑](milestones.md)

## 現行配置

2026-10-27 導入精簡、已適配、納入版控的 snapshot。根目錄只有
[AGENTS.md](../../AGENTS.md) 與 [CLAUDE.md](../../CLAUDE.md) 兩個工作流入口，
工作流內容全在 [wf/](../../wf/INDEX.md)。保留 dev 的開發／測試／環境與 knowledge 的寫作，
依現有 Hugo 專案適配；不執行會整包複製 kernel 的 wf-init。

- 來源固定為 `https://github.com/justty32/workflows.git` 的
  `368468a0cda612ffeb4d70bb72f39e765ed73327`（v0.6 與該 commit 的後續修訂）。
- 不使用 symlink、junction、submodule、本機絕對路徑或相鄰 repo 依賴。
- 不引入 skills、heartbeat、multi-agent、inbox 或排程工具；沒有額外的 Python／Node 執行需求。
- 網站 build 不依賴 `wf/`；工作流 validator 是獨立 PowerShell 指令，CI 在建站前另行執行。
- 原規劃的 MIT 前提改依來源實際 CC0-1.0 授權；CC0 已在本站 permissive allowlist。
  不導入上游另有授權的 skills。舊版缺授權的 commit 不作為來源。

## 逐檔範圍

完整 source blob SHA、destination 與 transformation 記在
[upstream-manifest.json](../../wf/upstream-manifest.json)，來源摘要與更新程序在
[UPSTREAM.md](../../wf/UPSTREAM.md)。以下只供導航，不以行號識別來源片段。

| 來源群組 | 目的地 |
|---|---|
| `template/AGENTS.md`、`template/CLAUDE.md` | 根入口；CLAUDE 保存原始 bytes |
| `template/{INDEX,WORKFLOWS,SESSION-LOG,WAIT_USER}.md` | `wf/` 同名文件 |
| `template/workflows/common/{README,gotchas,user,reply-style}.md` | `wf/workflows/common/` |
| `flavors/dev/workflows/feature-dev/README.md` | `wf/workflows/feature-dev/README.md` |
| `flavors/dev/workflows/{testing,dev-env}.md` | `wf/workflows/` |
| `flavors/dev/workflows/common/{conventions,code-map}.md` | `wf/workflows/common/` |
| `flavors/knowledge/workflows/write.md` | `wf/workflows/write.md` |
| `flavors/knowledge/workflows/common/writing.md`、`writing/zh-tw.md` | `wf/workflows/common/` 對應路徑 |
| dev、knowledge 的派發片段 | 只取已導入的工作流，合入 `wf/WORKFLOWS.md` |
| `LICENSE` | `wf/LICENSE.workflows-CC0.txt`，逐位元保存 |

舊 allowlist 的 `template/DEV-GUIDE.md` 已移除，由 `dev-env.md` 提供環境入口。
未導入工作流的連結與純文字導流一併裁除，不建立 `wf/AGENTS.md` shim。
活狀態初始為空，不搬入上游自己的進度或待辦。

## 驗收與更新

```powershell
pwsh -NoProfile -File scripts/verify-workflow-snapshot.ps1
pwsh -NoProfile -File scripts/test-workflow-snapshot.ps1
```

validator 不連網、不讀來源 checkout；檢查 inventory、SHA-256、來源 metadata 格式、
本地 Markdown 連結／錨點、模板殘留與未導入工作流的導流。負向 fixtures 證明檢查會擋錯。
來源 Git blob 的真實性須在更新時對 pinned commit 核對，離線 validator 不冒充來源認證。

`SESSION-LOG.md`、`WAIT_USER.md`、`common/gotchas.md`、`common/user.md` 為可日常更新檔案：
manifest 保留導入基準 hash，`mutable: true` 不強制現行 hash 相同，但仍檢查存在、連結和殘留。
其他快照文件適配後需同步更新 manifest 的 SHA-256。換行策略由 `.gitattributes` 固定，
授權全文與 exact-copy 入口不做 Git 換行轉換。

更新只從核對過的 commit tree 逐檔讀取，不複製來源 working tree；更新前後核對來源
HEAD/status，來源 checkout 不變。維持完整 license、manifest 與適配文件一起審查。
不自動追 upstream main，也不自動 commit／push。若由使用者提交，snapshot 與 verifier
適合獨立 commit，之後可單獨回滾；網站程式與內容不受影響。
