# 網站架構

[文件入口](README.md)｜[作者指南](AUTHORING.md)

網站使用固定的 Hugo Standard，在建置時把 Markdown、Go templates、CSS 與原生 JavaScript 產生成品。
內容與導覽不依賴 JavaScript；預設只載入偏好控制器，沉浸互動由讀者明確選擇後載入。
沒有 theme、遠端 module、外部 runtime 或 npm 建置相依。

## 內容與網址

`content/` 是唯一內容來源。文章使用 `content/posts/<年份>/<短名>/index.md` page bundle，
圖片與文章放一起；一般頁面放在 `content/`。網址由 `hugo.toml` 的 baseURL 和 permalink
決定，文章沿用 `/posts/:year/:contentbasename/`。相容網址由文章 front matter 的 aliases 保留。

主導覽在 `hugo.toml` 的 `menus.main` 設定，`pageRef` 指向 Hugo 頁面；新增頁面不需修改版型。
RSS 只收公開文章，文章清單、月份索引與 RSS 共用 `published-posts.html`。
robots.txt 從 baseURL 產生 sitemap 位置，換網域或 project base 時不需另改靜態網址。

## 版型與樣式

`layouts/baseof.html` 管理文件骨架，home、page、section、taxonomy、term、archive、404
各自提供內容。共用 partial 管理 head、導覽、頁尾、頁面標題、文章卡片與標籤；
`layouts/_markup/` 負責 Markdown 圖片和連結。

CSS 按職責拆在 `assets/css/`：

| 檔案 | 職責 |
|------|------|
| `base.css` | 衍生色彩變數、全域排版與基礎元素 |
| `layout.css` | 頁面容器、導覽與主要區塊 |
| `components.css` | 卡片、標籤等元件 |
| `prose.css` | 文章、程式碼與圖片 |
| `scene.css` | 首頁精密光環、光網與裝飾動畫 |
| `themes.css` | 光網、閱讀與深空三種美術風格，以及獨立日／夜模式 |
| `preferences.css` | 響應式、減少動畫與使用者偏好 |

`layouts/_partials/styles.html` 明確指定合併順序，並將 `data/appearance.toml` 的預設色
產生為各風格的 CSS 變數。Hugo 將它們合成同一個 `/css/site.css`，維持單一 CSS request；
不使用瀏覽器端 CSS import，也不需要額外編譯工具。正文、次要資訊與控制項以較大字級和
清楚對比呈現；光線、hover 與元件動畫維持裝飾層次，不改變內容的閱讀順序。

## 配色與互動

`data/appearance.toml` 是預設配色的唯一來源；`styles.grid`、`styles.paper`、`styles.deep`
各自包含 `day` 與 `night`，每組定義 `bg`、`surface`、`text`、`muted`、`primary`、
`secondary` 六個完整十六進位色碼。頂層 `default_style` 與 `default_mode` 決定未保存
個人偏好時的預設風格及日／夜模式，停用 JavaScript 時也適用。風格與日／夜模式獨立切換。
CSS 的 `--seed-*` 變數由這些值生成，邊框、光暈、背景層次與互動粒子由基準色衍生。
作者如何改預設色、訪客設定的差異見 [作者指南](AUTHORING.md#調整網站外觀)。

`layouts/_partials/appearance.html` 提供外觀面板。`assets/js/preferences.js` 經 Hugo
壓縮為 `/js/preferences.min.js` 並以 `defer` 載入，管理風格、日／夜模式、六色與動態偏好，
並提供程式碼複製、目錄目前章節標示與文章閱讀進度等輕量工具。
偏好儲存在 `localStorage` 的 `self-blog-appearance-v2`，包含 `style`、`mode`、
`motion` 與 `colors`；自訂色依風格、日／夜模式分開，例如 `colors.grid.night.primary`。
重設只清除目前風格及模式的自訂色。沒有 v2 設定時會讀取 v1，將舊閱讀風格與自訂色移到
`paper.day`，其餘風格移到各自的 `night`，保留原 v1 key。儲存不可用時仍能在當頁調整，
停用 JavaScript 時保留預設風格與可用的內容、導覽。

`assets/js/immersive.js` 壓縮為 `/js/immersive.min.js`。只有按下沉浸或奢華模式按鈕後才
動態載入；不預先下載、不跨頁自動啟用。普通沉浸提供事件驅動的卡片追光；首頁另有
canvas 光場，包含三層星場、雙平面星軌、游標局部引力與連線、點觸漣漪。光場可拖曳
並以阻尼回彈，觸控保留垂直捲動。普通沉浸的首頁光場限制在約 30 fps，其他頁面不建立
持續的 `requestAnimationFrame` 迴圈。

奢華模式每頁都建立固定的全頁 canvas，加入指標尾流、點觸水波、捲動景深與風格專屬場景：

| 風格 | 全頁場景與元件語彙 |
|------|--------------------|
| 光網 | 切角光速隧道、掃描線、透視網格、透明稜晶與方向光束 |
| 深空 | 星雲、多層星軌、受指標引力影響的星塵、玻璃透鏡與星芒耀光 |
| 閱讀 | 透光薄片、局部流體墨暈與水紋折射；以紙片取代星塵，光效強度較低 |

閱讀風格的 `createInkFluid` 使用小網格保存速度與兩層染料密度，以固定 1/60 秒步長進行
半拉格朗日平流、壓力投影與渦流修正，再將墨色放大繪製至全頁 canvas。指標移動只注入
局部動量與染料，持續按住時緩慢加墨；放開後沿既有流場擴散與消散。背景光帶的按壓強度
以時間平滑，形變限於指標附近，避免按下或放手時整片背景突然拉扯。

`drawLightField` 依三維頂點與景深投影半透明稜晶及薄片，玻璃球透鏡則取樣同一 canvas
局部畫面以呈現放大折射。指標移動的方向與速度帶動光束、星芒、耀光、鏡頭光斑與火星，
再以強光核心、弱光暈和半透明面疊出材質。主色、輔色與文字色經混色及色相偏移產生
色散、薄膜虹彩和多層漸變，沒有獨立固定的彩虹 palette；切換基準色會同步改變光效。

日間著重折射與深色細線，夜間強化發光層次。奢華的全頁與首頁 canvas 跟隨螢幕刷新率，
不套用普通模式的 30 fps 限制；canvas 像素比最高 2.5。按鈕、導覽、標籤、目錄與設定
元件也加入追光、微傾斜及點擊漣漪，玻璃面板有折射與景深。標題、段落和清單保留原有
文字 DOM，以整個區塊浮動及跟隨游標產生景深。選取文字或表單取得焦點時，文字與面板
位移暫停，背景繼續運作，避免打斷閱讀和操作。

開啟奢華會連動開啟沉浸，關閉奢華會銷毀全頁背景與文字動態、保留普通沉浸；關閉沉浸
則兩者都停止。沉浸與奢華都不儲存為跨頁偏好。首頁光場離開畫面時停止運算；頁面隱藏時
全頁與首頁 canvas 都暫停，關閉時清理 canvas、事件與暫時加入的文字屬性。
作業系統的 `prefers-reduced-motion` 優先於頁內設定；任一處要求減少動畫時，
停用沉浸、奢華與持續動畫。

## 腳本邊界

公開指令留在 `scripts/`，共用實作放 `scripts/lib/`：

| 入口／模組 | 職責 |
|-----------|------|
| `get-hugo.ps1` | 固定版本工具入口，載入 release／archive／cache helpers |
| `HugoRelease.ps1` | manifest、checksum 與 binary 版本 |
| `HugoArchive.ps1` | ZIP／tar 安全解壓 |
| `HugoCache.ps1` | 快取鎖、下載、暫存與安裝 |
| `Common.ps1` | 相容載入入口，載入 Paths 與 Processes |
| `Paths.ps1`／`Processes.ps1` | 路徑檢查、程序執行與 UTF-8 傳輸 |
| `verify.ps1` | production build 與讀取 Hugo 實際設定 |
| `SiteValidation.ps1` | 純產物檢查，可用離線 fixture 測試 |
| `publish.ps1` | main、乾淨 index、僅 content 變更的發布流程 |

預設取得 Hugo 會連網核對官方 checksum；離線建置可傳
`verify.ps1 -HugoPath <已驗證的 binary>`。自動下載支援 Windows／Linux amd64；
Linux tar 解壓另需 .NET 7 以上的 PowerShell runtime。

## 驗證與交付

```powershell
pwsh -NoProfile -File scripts/test-automation.ps1
pwsh -NoProfile -File scripts/test-site-validation.ps1
pwsh -NoProfile -File scripts/verify.ps1
pwsh -NoProfile -File scripts/verify-workflow-snapshot.ps1
pwsh -NoProfile -File scripts/test-workflow-snapshot.ps1
```

產物檢查涵蓋基礎輸出、本地 JavaScript 白名單、站內連結與 base path、RSS／sitemap XML，
以及完整部署目錄不超過 5,000,000 bytes 的預算。只允許預期的偏好與沉浸腳本，拒絕
inline script、事件處理屬性、JavaScript URL 與遠端腳本。
base path 從 Hugo 實際設定讀取，支援壓縮後不帶引號的 HTML 屬性；不依賴某篇範例文章存在。
圖片 alt／遠端來源由 render hook 檢查。偏好邏輯另以 `node scripts/test-appearance.cjs`
測試，不需要 npm 安裝；網站建置本身不使用 Node。畫面與互動仍須在瀏覽器檢查手機／桌面、
三種風格各自的日／夜模式、自訂色、沉浸／奢華連動、鍵盤、關閉 JavaScript 及減少動畫，
不能以建置通過代替。

GitHub Actions 在 Windows／Linux 執行同一套檢查；一般驗證與 Pages build 都包含
`node scripts/test-appearance.cjs` 的偏好及沉浸生命週期回歸測試，無需 npm 安裝。
Pages build 只讀取 repository 與 Pages 設定，
部署 job 才取得 pages write 與 id-token write。`public/` 是建置產物，不提交。

工作流採獨立 `wf/` 快照；網站 build／publish 不讀取它，CI 另外執行快照驗證。
