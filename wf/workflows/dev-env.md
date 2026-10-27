# dev-env — 開發環境與指令

[WORKFLOWS](../WORKFLOWS.md)｜[INDEX](../INDEX.md)

fresh clone、換機器或找指令時使用。完整作者流程見 [AUTHORING](../../docs/AUTHORING.md)，驗證清單見 [testing](testing.md)。

## 環境

Git 與 PowerShell 7 是必要工具；Linux tar 解壓需 PowerShell 7.3／.NET 7 以上。現有自動下載腳本支援 Windows／Linux amd64，依 [Hugo-165.psd1](../../scripts/Hugo-165.psd1) 固定 Hugo v0.165.0 Standard 並驗證 checksum；不用 npm、Node、theme 或 submodule。

預設建置即使已有 Hugo 快取，仍需網路取得官方 checksum。離線建置可用 `verify.ps1 -HugoPath` 明確指定已驗證的可用 binary；snapshot 驗證與自動化 fixture 可離線執行。

## 從 clone 到預覽

1. 確認 `git --version` 與 `pwsh --version` 可執行。
2. 從 repository 根目錄執行 testing 的建置檢查。
3. 在 PowerShell 執行下列預覽指令：

```powershell
$hugo = ./scripts/get-hugo.ps1
& $hugo server --buildDrafts --baseURL http://127.0.0.1:1313/self_blog/
```

開啟 `http://127.0.0.1:1313/self_blog/`；草稿僅供預覽。Done when：建置驗證成功且能查看預覽。

## 發布邊界

`pwsh -NoProfile -File scripts/publish.ps1 -Message "content: add post"` 會 commit 並 push，只有使用者授權發布時才執行。腳本要求 main、起始 index 無 staged 變更、變更僅限 content/。網站設定、工作流與其他變更須另行處理。

GitHub Pages 的帳號與權限由使用者管理；需要其操作時記入 [WAIT_USER](../WAIT_USER.md)。
