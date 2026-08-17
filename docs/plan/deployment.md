# GitHub Pages 與 URL 規劃

← [規劃入口](README.md)｜[架構](architecture.md)｜[里程碑](milestones.md)

## 1. Project-site base 是架構條件

`self_blog` 不是 `justty32.github.io` 根站；無 custom domain 時正式網址是：

```text
https://justty32.github.io/self_blog/
```

Astro 初始設定等價於：

```text
site: https://justty32.github.io
base: /self_blog
output: static
trailingSlash: always
build.format: directory
```

`base` 在設定檔寫成不帶尾斜線的 `/self_blog`，但**程式碼一律只透過 `import.meta.env.BASE_URL` 取用，且必須假設它帶尾斜線**。M2 的第一個 assertion 就是 `import.meta.env.BASE_URL.endsWith("/")`；若實作當時的 Astro 版本沒有補上尾斜線，則在 `src/config/site.ts` 匯出一個保證帶尾斜線的 `BASE` 常數，全站改用它。原因見 [§3](#3-canonicalrss-與-sitemap)。

不設定或安裝任何 adapter。`output: static` 只代表預設 prerender，本專案再加兩個強制條件：禁止 `export const prerender = false`，且 `posts/[slug]`、`tags/[tag]`、`archive/[year]/[month]` 都必須由 `getStaticPaths()` 完整列舉。驗證同時拒絕 server adapter、server entry、server manifest 與 runtime。

本機 build 使用這組預設；正式 Pages job 以 `actions/configure-pages` 的 `origin`、`base_path` 覆蓋同一組 build-time 設定。該 action 只提供／驗證 metadata，不會啟用 Pages，也不會自動修改 Astro。

因為 CI 會覆蓋，verify 與 smoke test 不得各自寫死 `/self_blog/`：它們從 build 實際採用的同一個設定來源取得 base，只在單一處斷言「解析後的 base 等於 `/self_blog/`」。否則覆蓋值與檢查值一旦分歧，verify 會變成假證據。

未來若改 custom domain，程式面集中改 `site` 與 `base`，營運面另完成 Pages Settings、DNS 與網域驗證；MVP 不包含此工作。

## 2. URL contract

預定 route：

```text
/self_blog/
/self_blog/posts/
/self_blog/posts/<slug>/
/self_blog/archive/
/self_blog/archive/<YYYY>/<MM>/
/self_blog/tags/
/self_blog/tags/<tag-slug>/
/self_blog/images/<slug>/<file>
/self_blog/rss.xml
/self_blog/sitemap-index.xml
/self_blog/sitemap-0.xml
/self_blog/licenses/
/self_blog/404.html
```

Astro／TypeScript component 只能使用 base-aware helper 或 `import.meta.env.BASE_URL`。普通 `.css` 無法插值該環境變數；CSS 內資產必須使用 module-relative URL 交給 Vite 重寫，或由 Astro markup 傳入已完成的 base-aware URL。禁止散落未處理的 `href="/..."`、`src="/..."`、`srcset` 或 `url(/...)`。

純 Markdown 作者使用 logical root URL：

```markdown
[另一篇](/posts/other-slug/)
```

build-time Markdown transformer 只對 internal logical URL 加上恰好一次 `BASE_URL`；`#anchor`、`mailto:` 與完整協定 URL 不改。文章的 `/images/...` 圖片連結走的是同一條 transformer，不需要另設機制。直接寫 `/self_blog/...` 視為重複 base 並讓檢查失敗。

## 3. Canonical、RSS 與 sitemap

所有絕對 URL 由同一組 helper 產生，而 helper 的前置條件是 base **帶尾斜線**：

```text
BASE          = ensureTrailingSlash(import.meta.env.BASE_URL)   // "/self_blog/"
canonicalRoot = new URL(BASE, context.site)                     // "https://justty32.github.io/self_blog/"
absolute(p)   = new URL(stripLeadingSlash(p), canonicalRoot)
```

尾斜線不是風格問題。`new URL("posts/x/", "https://justty32.github.io/self_blog")` 會把 `self_blog` 當成要被取代的最後一段，得到 `https://justty32.github.io/posts/x/`——base 靜默消失，而且產生的是語法合法、肉眼正常、只有部署後才 404 的 URL。因此：

- `ensureTrailingSlash` 是唯一入口；禁止在 component 或 endpoint 內直接 `new URL(import.meta.env.BASE_URL, ...)`。
- verify 對每一個 canonical、Open Graph URL、RSS channel/item link/guid 與 sitemap `<loc>` 斷言 `startsWith(canonicalRoot)`，並斷言字串中 `/self_blog/` 恰好出現一次（同時擋掉漏 base 與雙重 base）。

- RSS 的 `site` 使用 canonical root，item link 使用不帶前導 `/` 的 `posts/${slug}/`。
- feed channel、item link/guid、canonical、Open Graph 與 sitemap `<loc>` 必須以 `https://justty32.github.io/self_blog/` 開頭。
- `<head>` 用 base-aware URL 連到 `rss.xml` 與 `sitemap-index.xml`。
- `@astrojs/sitemap` 的預期輸出是 `sitemap-index.xml` 與至少 `sitemap-0.xml`。

此 repo 無法提供 origin 根 `https://justty32.github.io/robots.txt`；`/self_blog/robots.txt` 不是有效的 origin-wide robots 規則。因此 MVP 不宣稱提供 robots.txt，若需要須由根站 repo 管理。

## 4. 單一 Pages workflow

`.github/workflows/pages.yml` 觸發：

- pull request：verify only。
- push `main`：verify + upload + deploy。
- `workflow_dispatch`：任意 ref 可 verify，只有 `refs/heads/main` 可 upload/deploy。

所有 Action 在實作時核對當前版本後固定完整 commit SHA，旁註對應 release。

### Build job

權限只有讀取所需的 `contents: read`、`pages: read`；後者供 `configure-pages` 讀 Pages metadata，不授予部署寫入。官方 starter workflow 在 build job 給的是 `pages: write`，本專案刻意收斂，但這需要實測：M2 第一個 CI run 若 `configure-pages` 因權限失敗，先確認是不是 enablement 行為差異，再決定放寬成 `pages: write`，或改為不在 build job 呼叫該 action、由設定檔提供 base。無論如何都不在 deploy job 之外加 `id-token: write`。步驟：

1. checkout。
2. 可部署 run 執行 `actions/configure-pages`，把 output 明確映射給 Astro build config。
3. 安裝 Node 24，啟用 npm cache，執行 `npm ci`。
4. 執行唯一品質入口 `npm run verify`。
5. 確認 `dist/` 根直接含 `index.html`、`404.html`、`posts/<fixture>/index.html`。
6. 只有 main 非 PR run 才以 `actions/upload-pages-artifact` 的 `path: dist/` 上傳。

不得上傳 repo 根、包著一層 `dist/` 的父目錄或 `dist/self_blog/`。

Astro 的預設資產目錄是底線開頭的 `_astro/`。`actions/deploy-pages` 的部署路徑不執行 Jekyll，因此不需要 `.nojekyll`；但這是 Pages 最經典的 404 來源，所以 M2 的 smoke test 必須實際請求一個 `_astro/*.css` 並確認 HTTP 200，把這個假設變成證據而不是信念。

### Deploy job

- `needs: build`，並再次檢查 main／非 PR 條件。
- 權限只有 `pages: write`、`id-token: write`。
- environment 是 `github-pages`，deployment branch policy 只允許 `main`。
- environment URL 取 deploy step output。
- production concurrency 放在 workflow level，group 是 `pages-production`，涵蓋整個 build → upload → deploy run，`cancel-in-progress: false`；不得只放在 deploy job。
- PR 使用各自 group 並可取消舊 run，不進 production queue。

upload 成功、deploy 成功、部署後 smoke test 是三份不同證據，不互相冒充。

## 5. Artifact hard gate

`npm run verify:dist` 必須證明：

- `dist/index.html`、`dist/404.html`、fixture article 存在。
- 不存在 `404/index.html` 取代 `404.html` 的情況。
- 沒有任何 `.js`／`.mjs` artifact，browser script request 是 0。
- 解析全部生成 HTML，拒絕任何 `<script>`（包含 inline、module、import map）、`on*=` event attribute 與 `javascript:` URL；MVP 不用 JSON-LD script，「沒有外部 request」不能代替這項檢查。
- 解析全部生成 SVG，拒絕 script、event handler、`javascript:` URL 與外部資源引用。
- 沒有 server entry／manifest／adapter runtime、`node_modules`、`.map`、Markdown source、`wf/`、`docs/`、agent 檔、draft 或 build tool。
- `dist/images/` 與公開文章的圖片引用完全相等：每個 `/images/...` 連結都有實際檔案，且 `dist/images/` 沒有任何未被引用的檔案。兩個方向都要檢查。
- `media/` 本身不出現在 `dist/`；draft 引用的圖片不在 `dist/images/`。
- internal `href`、`src`、`srcset`、CSS URL、canonical、OG、RSS、sitemap 無漏 base／雙重 base。
- 公開 article/tag/month 的 `getStaticPaths()` 集合與 `getPublishedPosts()` 所產生的 route inventory 完全相等。
- 輕量 byte/request budget 通過，詳見 [architecture.md](architecture.md#7-訪客下載-hard-budget)。

preview smoke test 要把 `dist/` 實際掛在 `/self_blog/`，走訪完整公開 HTML route inventory，另驗證 RSS/head links、CSS、圖片／SVG；每頁 browser network 的 script request 都是 0。一個不存在的深層 URL 必須回 HTTP 404、顯示自訂頁，且返回首頁連結仍帶正確 base。

## 6. 站外人工步驟

repository 管理者需：

1. Settings → Pages → Source 選 GitHub Actions。
2. `github-pages` environment 只允許 `main` 部署。

不使用高權限 PAT 讓 workflow 自動啟用 Pages。M2 將這兩項寫進 `wf/WAIT_USER.md`，完成即移除。

## 參考

- [Astro configuration reference](https://docs.astro.build/en/reference/configuration-reference/)
- [Astro dynamic routes and `getStaticPaths()`](https://docs.astro.build/en/guides/routing/#dynamic-routes)
- [Astro GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/)
- [Astro RSS](https://docs.astro.build/en/recipes/rss/)
- [Astro sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages REST API permissions](https://docs.github.com/en/rest/pages/pages)
- [GitHub custom 404](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)
- [RFC 9309 robots.txt location](https://www.rfc-editor.org/rfc/rfc9309.html)
