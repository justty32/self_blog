# code-map — 程式碼導航

[common](README.md)｜[conventions](conventions.md)

## 領域

| 領域 | 入口與職責 | 驗證 |
|------|------------|------|
| 網站設定 | [hugo.toml](../../../hugo.toml)：base、輸出、路由、安全設定 | [verify.ps1](../../../scripts/verify.ps1) |
| 內容 | [content](../../../content/)：文章、一般頁面、圖片 | [作者指南](../../../docs/AUTHORING.md)、網站驗證 |
| 版型與樣式 | [layouts](../../../layouts/)、[CSS 模組](../../../assets/css/)：頁面、共用片段、render hooks | [架構說明](../../../docs/ARCHITECTURE.md)、網站驗證與瀏覽器檢查 |
| 配色與互動 | [appearance.toml](../../../data/appearance.toml)：風格基準色；[JavaScript](../../../assets/js/)：偏好保存與選擇性沉浸互動 | 網站驗證、偏好測試與瀏覽器檢查，見 [testing](../testing.md) |
| Hugo 與發布 | [scripts](../../../scripts/)：工具版本、下載快取、process wrapper、發布 | [test-automation.ps1](../../../scripts/test-automation.ps1) |
| CI 與部署 | [.github/workflows](../../../.github/workflows/)：跨平台驗證與 Pages artifact | GitHub Actions 執行結果 |
| 工作流 snapshot | [UPSTREAM](../../UPSTREAM.md)：來源、manifest、授權 | [verify-workflow-snapshot.ps1](../../../scripts/verify-workflow-snapshot.ps1)、[test-workflow-snapshot.ps1](../../../scripts/test-workflow-snapshot.ps1) |

## 真相與維護

程式／測試優先於 fixture、code map、一般文件與產物。歷史規劃可能與目前實作不同；先查實際行為，再修正受影響文件。產物永遠不是唯一來源。

修改前查相關領域；新增、移動檔案或改變職責後更新本表。它是導航，不取代行為規格；交付前保持程式、code map 與文件一致。
