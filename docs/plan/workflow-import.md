# workflows 非侵入式導入規劃

← [規劃入口](README.md)｜[授權](licensing.md)｜[里程碑](milestones.md)

## 1. 選定方式

採「精簡、已適配、納入版控的 vendored snapshot」。規劃時唯讀盤點的來源是 `https://github.com/justty32/workflows.git`，commit `7e7d20bb4d30271f8369acad5f85a267d66e9be1`；實際導入必須改 pin 上游已補妥授權的較新 commit。

- M1 vendoring 不修改本機 workflows checkout；M0 由權利人在 upstream 補授權是獨立前置工作。
- 不使用 symlink、junction、本機絕對路徑或其他相鄰 repo 依賴；fresh clone 與 CI 必須可重現。
- 不使用 git submodule；本專案只需要少量 Markdown，沒必要增加 clone 與審查狀態。
- CI 不自動追 upstream `main`。每次更新都 pin 完整 commit SHA、人工審差異並用獨立 commit 導入。
- repo 根部的 workflow 入口只有 `AGENTS.md` 與 `CLAUDE.md`，其餘進 `wf/`。
- 網站 build 不依賴 `wf/`；移除整合後仍應可建置。

這是實作規格，不授權本輪複製任何來源檔案。

## 2. 初次逐檔 allowlist

不能先複製整個資料夾再刪；M1 只從被 pin commit tree 匯出下列項目：

| upstream source | destination | mode |
|---|---|---|
| `template/AGENTS.md` | `AGENTS.md` | copy + project/link adaptation |
| `template/CLAUDE.md` | `CLAUDE.md` | exact copy；仍指同層 `AGENTS.md` |
| `template/WORKFLOWS.md` | `wf/WORKFLOWS.md` | copy + prune + merge dispatch |
| `template/INDEX.md` | `wf/INDEX.md` | copy + project/link adaptation |
| `template/DEV-GUIDE.md` | `wf/DEV-GUIDE.md` | copy + link adaptation |
| `template/SESSION-LOG.md` | `wf/SESSION-LOG.md` | copy + link adaptation |
| `template/WAIT_USER.md` | `wf/WAIT_USER.md` | copy + prune/link adaptation |
| `template/workflows/common/README.md` | `wf/workflows/common/README.md` | copy + link adaptation |
| `template/workflows/common/gotchas.md` | `wf/workflows/common/gotchas.md` | copy |
| `flavors/dev/workflows/feature-dev/README.md` | `wf/workflows/feature-dev/README.md` | copy + project/link adaptation |
| `flavors/dev/workflows/testing.md` | `wf/workflows/testing.md` | copy + project adaptation |
| `flavors/dev/workflows/common/conventions.md` | `wf/workflows/common/conventions.md` | copy + link adaptation |
| `flavors/knowledge/workflows/write.md` | `wf/workflows/write.md` | copy + prune/project adaptation |
| `flavors/knowledge/workflows/common/writing.md` | `wf/workflows/common/writing.md` | copy |
| `flavors/dev/WORKFLOWS.dev.md` | merge into `wf/WORKFLOWS.md` | only heading/table/common line；`7e7d20b` 當時位於 lines 3–9，行號僅供定位 |
| `flavors/knowledge/WORKFLOWS.knowledge.md` | merge into `wf/WORKFLOWS.md` | only `write` row；`7e7d20b` 當時位於 line 7，行號僅供定位 |

`wf/UPSTREAM.md` 要為每列記錄 source blob SHA、destination 與實際 transformation。更新時依語義重新找合併片段，不永久假設舊行號有效。

### 明確排除

M1 不引入 inbox、tick、routines、schedule、`.claude/commands/wf-tick.md`，也不引入 digest、plan、decide、learn、organize。

排除不只是不複製檔案；入口、派發表、表格、模板說明及純文字導流也要移除。後者未必會被 Markdown link checker 找到，因此 validator 必須另做 forbidden-term inventory scan。

## 3. 搬移後的適配規則

來源的 `non-invasive-import.md` 低估了反向連結的數量。M1 必須處理：

- 根 `AGENTS.md` 對 kernel 的連結加上 `wf/`。
- `wf/*.md` 回到入口時使用 `../AGENTS.md`。
- `wf/workflows/*.md` 回到入口時使用 `../../AGENTS.md`。
- `wf/workflows/<子目錄>/*.md` 回到入口時使用 `../../../AGENTS.md`。
- 反向 `AGENTS.md` link 的數量由 validator 自行列舉，本規劃不斷言常數。盤點 `7e7d20b` 時是 9 個（5 個在 `wf/*.md`、4 個在巢狀文件），但實際導入會 pin 另一個 commit，屆時該數字可能已不成立。M1 的通過條件是「零個未依深度改寫的反向連結」，不是「剛好 9 個」。根 `CLAUDE.md` 是例外，維持 `[AGENTS.md](AGENTS.md)`。
- 修正 `INDEX`、活狀態及各 workflow 內的「repo 根」描述，使其符合實際 `wf/` 位置。
- 移除全部 `{{...}}`、`〔模板說明〕`、`〔佔位〕`。
- 裁掉 kernel 內 inbox／scheduler 區段，以及 `write.md` 對 digest／plan-a-thing 的純文字導流。
- M1 的 `AGENTS.md` 只能指向當時已存在的 snapshot verifier；M2 建立 npm scripts 的同一個 commit，才改為 `npm run verify`。

不建立 `wf/AGENTS.md` shim。它只能遮住部分斷鏈，無法修正文意，還會多出一個容易被誤認為權威入口的檔案。

## 4. Provenance、授權保存與目標結構

M1 新增 `wf/UPSTREAM.md`，至少記錄：

- approved upstream remote URL 與完整 commit SHA；
- upstream license/notice 的來源路徑與 SHA-256；
- 每個 allowlist source 的 blob SHA、destination、transformation mode；
- 本地適配規則；
- 導入／更新日期。

上游完整 MIT notice 逐位元保存為 `wf/LICENSE.workflows-MIT.txt`。授權前置條件詳見 [licensing.md](licensing.md)。

預定結果：

```text
AGENTS.md
CLAUDE.md
wf/
  WORKFLOWS.md
  INDEX.md
  DEV-GUIDE.md
  SESSION-LOG.md
  WAIT_USER.md
  UPSTREAM.md
  LICENSE.workflows-MIT.txt
  workflows/
    feature-dev/README.md
    testing.md
    write.md
    common/{README.md,gotchas.md,conventions.md,writing.md}
scripts/
  verify-workflow-snapshot.mjs
```

## 5. 可重現的導入與更新程序

1. 確認 remote URL 在 approved list，記錄來源 `rev-parse HEAD` 與完整 `status --porcelain`。
2. 確認被 pin commit 已通過授權 gate。
3. 只從 commit tree 使用 `git archive <SHA> -- <allowlist>` 或 `git show <SHA>:<path>` 匯出；不得直接複製可能帶未提交變更的 working tree。
4. 人工重套本文件的適配，產生 manifest、notice hash 並執行 M1 validator。
5. 以單一、可獨立 revert 的 commit 更新 snapshot、notice 與 `UPSTREAM.md`。
6. 再次記錄來源 HEAD/status，證明本機來源前後完全不變。

CI 永遠不讀 upstream 或本機 workflows checkout。更新失敗時 revert 該次 snapshot commit；網站程式與內容不受影響。詳細 Done when 見 [milestones.md](milestones.md)。
