# ADR-0001：Mermaid spike 的 Profile B 授權證據

- 狀態：Accepted
- 日期：2026-08-17
- 範圍：僅 M0 Mermaid renderer spike 的第三方建置工具
- 依據：[授權規劃](../licensing.md)、[OPUS 交接 §5](../OPUS_ADVICE.md#五交接給實作者)

## 背景

第一個 renderer 候選是官方 `mermaid@11.16.1` 搭配
`puppeteer-core@25.7.0`。在尚未提交 candidate dependency 的 working copy 中
產生完整候選 lock，再執行既有 gate；預檢發現兩個 Profile B 無法自行判定的
項目：

1. `robust-predicates@3.0.3` 明確宣告 `Unlicense`，但原 Profile B 沒有列出
   這個 permissive／public-domain dedication 授權；
2. `khroma@2.1.0` 的 npm package metadata 沒有 `license` 欄位，但同一版
   registry tarball 內含 `license` 檔，上游 tag 也保存完整 MIT notice。

其餘 lockfile 授權 expression 都能由既有 Profile B 規則判定。這些套件只在
建置流程使用，不會進入 GitHub Pages artifact，也不會成為讀者下載內容。

## 決策

1. Profile B allowlist 加入 SPDX `Unlicense`。本專案自有程式、文章、圖表與
   素材仍只由根 MIT `LICENSE` 涵蓋；這不把第三方程式重新授權成 MIT。
2. missing metadata 仍預設失敗。唯一例外是下列逐欄精確相符的 artifact：

   | 欄位 | 固定值 |
   |---|---|
   | lock locator | `node_modules/khroma` |
   | version | `2.1.0` |
   | resolved | `https://registry.npmjs.org/khroma/-/khroma-2.1.0.tgz` |
   | integrity | `sha512-Ls993zuzfayK269Svk9hzpeGUKob/sIgZzyHYdjQoAdQetRKpOLj+k/QQQ/6Qi0Yz65mlROrfd+Ev+1+7dz9Kw==` |
   | audited license | `MIT` |
   | artifact license path | `license` |
   | upstream evidence | <https://github.com/fabiospampinato/khroma/blob/v2.1.0/license> |

3. 使用這筆 missing-metadata 證據時，任何 locator、版本、來源或 integrity
   改變都回到 fail closed；不能用 package name-only override，也不能新增未經
   ADR 的例外。若未來 lockfile 本身提供非空 SPDX metadata，則回到一般
   Profile B 規則判定。
4. renderer 使用 `puppeteer-core` 與執行環境既有瀏覽器，不由 npm 安裝腳本
   下載或隨 repo／Pages artifact 分發 browser binary。實測報告必記錄實際
   browser product/version。

`robust-predicates@3.0.3` 的上游授權證據：
<https://github.com/mourner/robust-predicates/blob/v3.0.3/LICENSE>。

## 候選 lock 預檢證據

這一筆 ADR commit 刻意不包含 Mermaid dependency 或 renderer；否則會違反
「gate 先於功能」的 commit 邊界。預檢是在相同 package 暫時加入以下 exact
devDependencies 後執行，完成後已還原：

```json
{
  "mermaid": "11.16.1",
  "puppeteer-core": "25.7.0"
}
```

環境與結果：

| 項目 | 結果 |
|---|---|
| Node / npm | `v24.16.0` / `11.13.0` |
| 產生命令 | `npm install --package-lock-only --ignore-scripts` |
| candidate lock SHA-256 | `6eea1023ea58c4d93e0c700f8ec1456c95da2eafd1b4a47ae9b4828c0c87dc51` |
| instances | 144（root 1、direct 6、transitive 137；dev-only 143） |
| pinned evidence | 1（`khroma@2.1.0`） |
| expressions | `MIT`、`ISC`、`BSD-3-Clause`、`CC0-1.0`、`Apache-2.0`、`Unlicense`、`(MPL-2.0 OR Apache-2.0)` |
| gate 結果 | pass；missing 0、unknown 0、denied 0 |

下一個 implementation commit 必須提交實際 candidate lock，重新執行相同 gate，
並核對上述 hash 與摘要。若 dependency resolution 不同，視為新的輸入重新稽核，
不得在同一個 implementation commit 修改本 gate。

## 後果

- 可繼續使用完整官方 Mermaid parser／layout，而不是自製 flowchart 引擎。
- license inventory 必標出 `khroma` 使用的是 `pinned-artifact-evidence`，不能偽裝
  成 lockfile 原生 metadata。
- Profile A（strict MIT-only）仍不通過，也沒有因此被放寬。
- 若審查者不接受 `Unlicense`，可單獨 revert 本 ADR 與對應 gate commit；renderer
  implementation commit 不得藉此修改 gate。

## 未採方案

- 不手改 `package-lock.json` 補上 `license`：下一次 npm 重建會遺失，也無法說明
  證據來源。
- 不忽略 missing license 或只按 package name 放行：無法綁定已審核 artifact。
- 不改用自製 SVG layout：維護與相容性成本遠高於這個明確、可逆的授權決策。
