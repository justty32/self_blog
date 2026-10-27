# feature-dev — 功能開發與修 bug

[WORKFLOWS](../../WORKFLOWS.md)｜[INDEX](../../INDEX.md)

用於功能、行為修改與 bug 修正。純查詢直接依相關程式回答；只整理結構時先確認行為維持不變。

## 流程

1. 讀 [conventions](../common/conventions.md) 與 [code-map](../common/code-map.md)，找到相關程式及既有檢查。
2. 確認預期結果，保留使用者既有變更，逐步修改；多步驟工作記入 [SESSION-LOG](../../SESSION-LOG.md)。
3. 依 [testing](../testing.md) 執行適用驗證；修 bug 時確認原本會失敗的情境已改善。
4. 更新受影響的 code map、作者文件及工作流文件，回報實際驗證結果。commit／push 依使用者授權。

## Done when

- 需求已達成，相關驗證回傳 0；沒有把未執行的檢查宣稱通過。
- 程式、code map 與文件一致；跨 session 未完成工作留有下一步。
- 確實需要使用者實機或帳號處理的項目已記在 [WAIT_USER](../../WAIT_USER.md)。

驗證方式見 [testing](../testing.md)；重複發生的共通問題記在 [gotchas](../common/gotchas.md)。
