# conventions — 程式碼慣例

[common](README.md)｜[code-map](code-map.md)

碰程式前讀本檔；檔案職責與真相層優先序見 code map。

- 網站使用固定 Hugo Standard、自有 layouts、CSS 與原生 JavaScript；不加入遠端 theme、module 或外部 runtime 相依。內容與導覽在停用 JavaScript 時仍可使用。
- 預設只載入輕量偏好控制器；沉浸特效須由讀者明確選擇後才動態載入。關閉、離開可見區域或減少動畫時停止持續運算，遵循 `prefers-reduced-motion`。
- 全站配色由 [appearance.toml](../../../data/appearance.toml) 的六個基準色衍生；元件與特效不另藏固定品牌色。視覺有層次、互動細緻，避免特效妨礙閱讀。
- 部署產物以 5,000,000 bytes 為建置預算；新增素材或特效後量實際產物總量，不以 repository 大小代替。
- 站內連結保留 `/self_blog/` base；修改 render hooks、RSS 或路由後執行網站驗證。
- 文章與圖片使用 `content/` page bundle；front matter、草稿與一般頁面規則以 [作者指南](../../../docs/AUTHORING.md) 和實作為準。
- PowerShell 腳本共用 [Common.ps1](../../../scripts/lib/Common.ps1) 的 process／錯誤處理，維持 Windows／Linux 路徑及 UTF-8 行為；改行為時同步相關 fixture。
- `public/`、`resources/`、`.hugo-validation/` 不提交；不以產物反向修改來源。
- 工作流使用 repository 內相對連結，來源 pin 與逐檔紀錄見 [UPSTREAM](../../UPSTREAM.md)；更新後跑 snapshot 驗證。
- 變更前確認 Git 狀態，保留既有修改；不把無關檔案一起納入提交。
