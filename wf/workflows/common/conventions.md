# conventions — 程式碼慣例

[common](README.md)｜[code-map](code-map.md)

碰程式前讀本檔；檔案職責與真相層優先序見 code map。

- 網站使用固定 Hugo Standard、自有 layouts 與 CSS；讀者端不加入 JavaScript、遠端 theme 或 module。
- 站內連結保留 `/self_blog/` base；修改 render hooks、RSS 或路由後執行網站驗證。
- 文章與圖片使用 `content/` page bundle；front matter、草稿與一般頁面規則以 [作者指南](../../../docs/AUTHORING.md) 和實作為準。
- PowerShell 腳本共用 [Common.ps1](../../../scripts/lib/Common.ps1) 的 process／錯誤處理，維持 Windows／Linux 路徑及 UTF-8 行為；改行為時同步相關 fixture。
- `public/`、`resources/`、`.hugo-validation/` 不提交；不以產物反向修改來源。
- 工作流使用 repository 內相對連結，來源 pin 與逐檔紀錄見 [UPSTREAM](../../UPSTREAM.md)；更新後跑 snapshot 驗證。
- 變更前確認 Git 狀態，保留既有修改；不把無關檔案一起納入提交。
