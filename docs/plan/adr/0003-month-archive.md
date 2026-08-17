# ADR-0003：月份瀏覽採單一 archive 頁與 anchors

- 狀態：Accepted
- 日期：2026-08-17
- 範圍：依發布月份尋找文章的路由與成長邊界
- 依據：[架構](../architecture.md)、[部署與驗證](../deployment.md)、
  [R2 回覆](../OPUS_ADVICE_REPLY.md)

## 背景

本站必須讓讀者依發布月份尋找文章。Hugo 可以直接用 `.Date` 與
`GroupByDate "2006-01"` 產生月份分組，但不會因日期自動建立每個
`/archive/YYYY/MM/` route。MVP 應避免為此增加自訂 taxonomy、front matter 欄位、
前置 generator 或 client-side filter。

單一 archive 頁的缺點是會隨文章數線性成長。因此選擇簡單 route 時，必須同時提供
可機械驗證的下載上限，不能讓這一頁無限膨脹。

## 決策

1. MVP 只產生 `/archive/`，依 Hugo 原生 `.Date` 使用 `GroupByDate "2006-01"` 分組。
2. 每個月份建立穩定的 `YYYY-MM` element ID；文章日期連到 `/archive/#YYYY-MM`。
3. 不建立月份 front matter、月份 taxonomy、`/archive/YYYY/MM/` route 或瀏覽器端篩選。
4. 每次 production build 都量測實際 `/archive/`。HTML、共用 CSS 與 favicon 的 raw
   artifact bytes 合計不得超過 120 KiB、不得超過 6 requests，並且必須是 0 JavaScript、
   0 image request。`1 KiB = 1024 bytes`；不模擬會隨 server/runtime 改變的 gzip、Brotli 或
   HTTP headers。
5. request 集合是從 archive HTML 出發、遞迴解析 HTML auto-load 與 CSS
   `@import`／`url()` 得到的 canonical local artifact closure；HTML 本身也算一個 request，
   同一 artifact 只計一次。無法解析、第三方 auto-load、JavaScript 或 source map 直接失敗。
6. 超過任一 hard budget 時 build fail closed。不得直接提高數字；須另立 ADR，在 Hugo
   static pagination 與月份獨立頁之間重新選擇，並保留或遷移既有月份深層連結。
7. archive 的月份集合、排序與文章集合必須和 production published-post projection 一致；
   draft 不得出現在頁面或其 links。

## 後果

- 作者只填 Hugo 原生 `date`，不維護衍生月份資料。
- 讀者可分享 `/archive/#YYYY-MM`，滿足以月份定位文章，但 MVP 不承諾月份獨立頁 URL。
- 頁面保持 0 JavaScript，且成長由讀者實際下載 budget 約束。
- 未來改成 pagination 或月份頁屬於公開 URL／導覽行為變更，必須用新 ADR 處理，而不是
  在 verifier 裡靜默放寬。

## 未採方案

- 每月獨立頁：路由更細，但 Hugo 原生日期分組不會自行建立這些頁，MVP 需要額外 generator。
- 月份 taxonomy／front matter：要求作者維護可由 `date` 推導的重複資料，容易不一致。
- client-side filter：會違反 0 client JavaScript 目標，且初始 HTML 仍可能無限成長。
- 只設文章數門檻：文章標題與 metadata 長度不同；真正需要保護的是 transfer 與 requests，
  不是預先猜測第幾篇文章會超標。
