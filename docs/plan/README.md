# 建站規劃與決策記錄

[現行文件入口](../README.md)｜[現行架構](../ARCHITECTURE.md)｜[作者指南](../AUTHORING.md)

本目錄保留 2026-08 建站時的規劃、ADR 與審查證據。它描述設計目標，不能視為
所有里程碑已完成的證明；日常操作以現行文件與實作為準。

原規劃中獨立 `media/`、candidate-tree 發布、`-Content`／`-TestMode` 參數、
120 KiB archive budget 與雙 theme 等細節，不能直接套用到目前網站。
目前作者流程使用 content page bundle，發布腳本只接受 content 變更；完整現況見架構說明。

[workflows 非侵入式導入](workflow-import.md) 是本目錄的現行規格，來源與授權另見
[UPSTREAM](../../wf/UPSTREAM.md)。其餘文件作為歷史規劃與決策記錄保留。

## 文件地圖

| 文件 | 記錄內容 |
|------|----------|
| [architecture.md](architecture.md) | 原訂 Hugo 內容、路由、圖片、樣式與輸出 contract |
| [deployment.md](deployment.md) | 原訂 Pages、artifact 與發布驗證方案 |
| [workflow-import.md](workflow-import.md) | 現行 workflows 快照範圍與更新驗收 |
| [licensing.md](licensing.md) | 授權與供應鏈規劃；workflows 授權已同步現況 |
| [milestones.md](milestones.md) | 原訂里程碑與條件式驗收清單 |
| [review-checklist.md](review-checklist.md) | 原訂審查與 sign-off 條件 |
| [OPUS_ADVICE.md](OPUS_ADVICE.md) | 建站設計審查記錄 |
| [OPUS_ADVICE_REPLY.md](OPUS_ADVICE_REPLY.md) | 審查回覆與裁決記錄 |
| [ADR-0001](adr/0001-mermaid-profile-b-evidence.md) | 歷史 Mermaid spike |
| [ADR-0002](adr/0002-hugo-no-npm.md) | 採用 Hugo、無 npm 與 production Mermaid |
| [ADR-0003](adr/0003-month-archive.md) | 單頁月份索引與原訂成長 budget |
