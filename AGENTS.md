# self_blog — AI agent 專案備忘

self_blog 是以 Hugo 建置、由 GitHub Pages 提供的個人部落格，文章使用 Markdown，讀者端不載入 JavaScript。本檔是入口，工作細節放在下一層。

## 開場與入口

- 先用 `rg -c '^- \[' wf/SESSION-LOG.md wf/WAIT_USER.md` 查看未完成項目；有項目再讀 [SESSION-LOG](wf/SESSION-LOG.md) 與 [WAIT_USER](wf/WAIT_USER.md)。沒有匹配時 `rg` 回傳 1 是正常結果。
- 動手前從 [WORKFLOWS](wf/WORKFLOWS.md) 選入口；專案結構見 [INDEX](wf/INDEX.md)。
- 碰程式前讀 [conventions](wf/workflows/common/conventions.md)、[code-map](wf/workflows/common/code-map.md)；環境見 [dev-env](wf/workflows/dev-env.md)。
- 使用者偏好與回覆方式見 [user](wf/workflows/common/user.md)。

## 共通規則

1. 保留使用者既有變更；重構維持行為，編輯文章維持原意。依 [testing](wf/workflows/testing.md) 跑相關驗證，回報實際結果與限制。
2. commit、push、發布及其他不可逆或對外動作須有使用者授權；已授權的範圍可持續完成，不重複確認。
3. Hugo 網站維持無 client JavaScript；建置產物不納入版控。工作流程文件不成為網站建置相依。
4. 長期知識寫在所屬文件，活狀態只留未完成項目；來源與更新方式見 [UPSTREAM](wf/UPSTREAM.md)。

<!-- wf-kernel v0.6 (2026-09-02); project-adapted minimal snapshot -->
