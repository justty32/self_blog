# WORKFLOWS — 工作流派發器

[AGENTS](../AGENTS.md)｜[INDEX](INDEX.md)

使用者要做事時，從下表讀對應入口。小範圍、低風險修正或一次性問答可以直接處理；仍須讀相關上下文、保留既有變更並做必要驗證。

## 派發表

碰程式共用 [conventions](workflows/common/conventions.md) 與 [code-map](workflows/common/code-map.md)。

| 意圖 | 工作流入口 |
|------|------------|
| 新增功能、修改行為、修 bug | [feature-dev](workflows/feature-dev/README.md) |
| 跑測試、確認改動沒有破壞功能 | [testing](workflows/testing.md) |
| fresh clone、環境或指令問題 | [dev-env](workflows/dev-env.md) |
| 寫文章、文件、翻譯、改稿 | [write](workflows/write.md) |
| 記錄或查找重複發生的坑 | [gotchas](workflows/common/gotchas.md) |
| 記錄使用者偏好 | [user](workflows/common/user.md) |

都不符合時先看 [INDEX](INDEX.md)，依任務判斷必要步驟；不要為一次性工作建立空文件。

## 活狀態

等使用者親自做、驗證或決定的事記 [WAIT_USER](WAIT_USER.md)；進行中工作與同 repo agent 協作記 [SESSION-LOG](SESSION-LOG.md)。只留未完成項目，完成即移除。
