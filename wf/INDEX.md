# INDEX — self_blog 專案地圖

[AGENTS](../AGENTS.md)｜[WORKFLOWS](WORKFLOWS.md)

採非侵入式佈局：工作流入口只在 repo 根新增 AGENTS.md／CLAUDE.md，工作流內容集中於 wf/；驗證腳本沿用 scripts/。網站建置不需要讀取 wf/。

## Repo 佈局

| 路徑 | 內容 |
|------|------|
| [content](../content/) | Markdown 文章、一般頁面及文章圖片 |
| [layouts](../layouts/) | 自有 Hugo 頁面、共用片段與 Markdown render hooks |
| [assets](../assets/) | 網站 CSS、偏好控制器與選擇性沉浸互動 |
| [data](../data/) | 各視覺風格的基準色彩設定 |
| [static](../static/) | favicon 與社群預覽圖 |
| [hugo.toml](../hugo.toml) | 網站網址、語系、路由與安全設定 |
| [scripts](../scripts/) | Hugo 取得、建置驗證、腳本測試與發布 |
| [.github/workflows](../.github/workflows/) | Windows／Linux 驗證與 Pages 部署 |
| [docs](../docs/) | [現行文件](../docs/README.md)、作者指南與歷史規劃 |
| [wf](WORKFLOWS.md) | 精簡工作流與 [共享慣例](workflows/common/README.md) |

## 工作流文件

- [WORKFLOWS](WORKFLOWS.md)：依意圖選工作流。
- [SESSION-LOG](SESSION-LOG.md)：進行中項目。
- [WAIT_USER](WAIT_USER.md)：確實需要使用者處理的項目。
- [UPSTREAM](UPSTREAM.md)：固定來源版本、授權、適配及更新方式。

`public/`、`resources/`、`.hugo-validation/` 是忽略的產物；不作為來源，也不提交。
