# MIT 與第三方授權規劃

← [規劃入口](README.md)｜[workflows 導入](workflow-import.md)｜[里程碑](milestones.md)

## 1. 本專案的 MIT 邊界

- 本倉庫自行創作的程式碼、文章、圖表與素材全部由根 `LICENSE` 以 MIT 發佈。
- README 必須清楚寫出上述範圍，避免把第三方內容誤解成由本專案重新授權。
- npm 套件、GitHub Actions、vendored code 與其他第三方內容保留各自 upstream license；需要的聲明整理進 `THIRD_PARTY_NOTICES.md`。
- 正式文章不得直接收錄來源不明的圖片、字型、角色圖或貼圖。首版使用 system fonts、自製 CSS/SVG 與自有截圖。
- `media/` 下的截圖在本 repo 內，由根 `LICENSE` 一併以 MIT 涵蓋。若某張截圖包含第三方 UI 或素材，該張要在 `THIRD_PARTY_NOTICES.md` 個別註記，不因為檔案在本 repo 就推定可再授權。

## 2. M0 選定 license profile

M0 要記錄 reviewer、日期、plan commit SHA 及所選 profile。預設採 B；只有審查者明確要求連第三方 transitive dependency 也必須是 MIT，才改採 A。

### B — 自有產物 MIT + permissive third-party（預設）

自有產物全部 MIT。第三方候選 allowlist 是：

```text
MIT
ISC
BSD-2-Clause
BSD-3-Clause
0BSD
Apache-2.0
CC0-1.0
```

第三方保留原授權與必要 notice。SPDX `OR` expression 只有在能選到 allowlist 分支時通過；`AND` expression 的每一項都要通過。missing、unknown 或未列 license 一律失敗。人工例外必須另有 Accepted ADR，不能只改 validator allowlist。

### A — strict MIT-only（額外選擇）

所有 direct/dev/transitive npm package、Action 與 vendored code 的 SPDX expression 都必須可單獨解析為 `MIT`；missing、unknown 或其他 license 直接失敗。如果 Astro 的實際 lock tree 不符合，就回到架構 ADR 換技術，不得默默放寬。

A 與 B 不是對稱的二選一。Astro 全樹與任何 build-time Mermaid renderer 幾乎必然混有 Apache-2.0、ISC 與 BSD-2/3-Clause，headless browser 依賴更是如此。因此選 A 實務上等於要求重新選型（見 [architecture.md](architecture.md) 的替代方案表），而不是「同一套技術棧再嚴格一點」。要求 A 的審查者請連同這個後果一起決定。

## 3. 稽核範圍與時點

授權 inventory 要涵蓋：

- npm lockfile 的完整 dependency tree；
- 所有 `uses: owner/repo@<SHA>` GitHub Actions；
- vendored workflows 及其他複製進 repo 的程式／文件；
- 字型、圖示、圖片與其他素材；
- 實際送到瀏覽器的 bundle 與資產。

第一次加入 dependency 前就做可行性稽核，M2 第一次部署前建立正式 inventory，之後納入 `npm run verify`。結果要能和 `THIRD_PARTY_NOTICES.md` 雙向核對。

實際交付到瀏覽器的第三方內容若要求 notice，Pages artifact 提供可讀的 license/notice 頁或文字檔。只在 build/CI 使用的 package 不把套件本體送進 artifact，也不把它誤列成閱覽者必須下載的內容。

## 4. workflows 是目前的硬 blocker

唯讀盤點的 workflows commit `7e7d20bb4d30271f8369acad5f85a267d66e9be1` 沒有 LICENSE、SPDX、copyright notice 或其他授權聲明。不能因 remote 同屬 `justty32`，或 `self_blog` 已有 MIT License，就推定該模板可以複製和再散布。

開始 M1 前，workflows 權利人必須在 upstream：

1. 加入完整 MIT `LICENSE`；
2. 明確讓授權涵蓋要導入的既有 allowlist 內容、既有貢獻及其衍生來源；
3. 產生一個包含該授權的新 commit，供本專案 pin。

M1 首次 snapshot 要把 upstream 完整 copyright/permission notice 逐位元保存至 `wf/LICENSE.workflows-MIT.txt`，並在 `wf/UPSTREAM.md` 記錄來源路徑與 SHA-256。不能只記 `MIT` 或一個 URL，也不能延後到上線硬化階段。

未通過此 gate 時，只保留規劃，不複製任何 workflows 檔案。

## 5. 審查依據

- [GitHub：Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [Open Source Initiative：MIT License](https://opensource.org/license/mit)
