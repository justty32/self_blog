# testing — 測試與驗證

[WORKFLOWS](../WORKFLOWS.md)｜[INDEX](../INDEX.md)

改完後依影響範圍選檢查。環境問題先看 [dev-env](dev-env.md)；修正失敗原因回 [feature-dev](feature-dev/README.md)。以下指令從 repository 根目錄執行。

## 驗證表

| 變更範圍 | 指令／檢查 | 執行者 |
|----------|------------|--------|
| 網站版型、CSS、JavaScript、設定、內容或建置腳本 | `pwsh -NoProfile -File scripts/verify.ps1` | agent；含 5,000,000 bytes 產物預算 |
| 偏好控制器或沉浸互動 | `node scripts/test-appearance.cjs`，另檢查瀏覽器實際互動與按需載入 | agent；Node 測試不需 npm 安裝 |
| PowerShell 自動化、快取或發布腳本 | `pwsh -NoProfile -File scripts/test-automation.ps1` | agent；離線 fixture，不發布 |
| 工作流文件、來源清單或授權檔 | `pwsh -NoProfile -File scripts/verify-workflow-snapshot.ps1` | agent；離線 |
| 網站產物檢查規則 | `pwsh -NoProfile -File scripts/test-site-validation.ps1` | agent；離線正向與負向 fixture |
| snapshot verifier 或 manifest 契約 | `pwsh -NoProfile -File scripts/test-workflow-snapshot.ps1` | agent；正向與負向 fixture |
| 版型、CSS 或互動外觀 | 預覽手機／桌面、光網／閱讀／深空、自訂色、鍵盤操作、中文排版、停用 JavaScript 與減少動畫；確認沉浸模組初始不下載 | 有可用瀏覽器時由 agent 檢查，否則列明未驗證項目 |

Done when：適用指令回傳 0；必要但無法完成的驗證在 [WAIT_USER](../WAIT_USER.md) 記明原因與通過條件。缺少本機工具時先檢查可用環境，不把所有測試直接交給使用者。

## 綠燈的證據

新增或修改驗證規則時，用應該失敗的輸入證明它會拒絕，再確認有效輸入通過。搬檔或拆目錄後檢查掃描範圍仍涵蓋實際來源。建置通過只代表腳本檢查通過，不能取代畫面驗收。

CI 會在 Windows 與 Linux 跑網站與自動化驗證；本機只跑過其中一個平台時，如實報告範圍。不要用發布指令代替測試。
