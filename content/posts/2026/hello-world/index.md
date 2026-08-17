---
title: 這個 Blog 為什麼選 Hugo
description: 用最少的 runtime 與依賴，把 Markdown 變成可以直接閱讀的靜態網站。
date: 2026-08-17
tags:
  - Hugo
  - 靜態網站
categories:
  - 工具
---

我想要的其實很普通：寫一篇 Markdown、放進資料夾、跑一個指令，然後得到可以直接部署的 HTML。

## 讀者不需要前端 runtime

Hugo 在建置時完成 Markdown 解析、文章列表、標籤、月份整理、RSS 與 sitemap。部署後留下的是 HTML 和 CSS；瀏覽器不用再下載一套框架才能顯示文章。

```text
Markdown → Hugo build → HTML/CSS → GitHub Pages
```

## 內容維持簡單

文章只需要 Hugo 原生 front matter：標題、摘要、發布日期與標籤。需要更新日期或分類時再加，不另造一套內容模型。

你也可以從[關於頁](/about/)繼續看這個網站的定位。

