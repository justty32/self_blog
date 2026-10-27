# self_blog

一個輕量的 Hugo 個人部落格。文章以 Markdown 撰寫，建置後提供普通 HTML 與 CSS；讀者端不載入 JavaScript framework。

- 本機檢查：`pwsh ./scripts/verify.ps1`
- 自動化回歸檢查：`pwsh ./scripts/test-automation.ps1`（離線測試，不會發布）
- 發布內容：`pwsh ./scripts/publish.ps1 -Message "content: add post"`
- 工作流入口：[AGENTS.md](AGENTS.md)；來源與更新：[wf/UPSTREAM.md](wf/UPSTREAM.md)
- 工作流檢查：`pwsh ./scripts/verify-workflow-snapshot.ps1`（離線）
- 文件與架構：[docs/README.md](docs/README.md)
- 網站檢查回歸：`pwsh ./scripts/test-site-validation.ps1`（離線）
- 寫作說明：[docs/AUTHORING.md](docs/AUTHORING.md)

正式網址：<https://justty32.github.io/self_blog/>

本 repository 自有程式碼、文章與素材採 [MIT License](LICENSE)。Hugo 本身採 Apache-2.0，GitHub Actions 各依其上游授權。

工作流快照衍生自 workflows，採 CC0-1.0；原文保存在 [wf/LICENSE.workflows-CC0.txt](wf/LICENSE.workflows-CC0.txt)。
