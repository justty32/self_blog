Set-StrictMode -Version Latest

function Assert-SiteArtifact {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PublicDir,
        [Parameter(Mandatory)][uri]$BaseUrl
    )

    $root = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($PublicDir))
    $basePath = $BaseUrl.AbsolutePath.TrimEnd('/') + '/'
    # Site infrastructure only: published articles are content, not build dependencies.
    foreach ($required in @('index.html', 'index.xml', 'sitemap.xml', 'robots.txt', '404.html', 'css/site.css')) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $required) -PathType Leaf)) {
            throw "建置缺少必要檔案：public/$required"
        }
    }
    $files = @(Get-ChildItem -LiteralPath $root -Recurse -File)
    $bytes = ($files | Measure-Object -Property Length -Sum).Sum
    $maximumBytes = 5000000
    if ($bytes -gt $maximumBytes) { throw "網站產物超過 5 MB 預算：$bytes / $maximumBytes bytes" }
    # Heavy effects are loaded by the preference controller only after opt-in.
    $allowedScripts = @('js/preferences.min.js', 'js/immersive.min.js')
    $scriptCount = 0
    foreach ($file in $files) {
        $artifactPath = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
        if ($file.Extension -in @('.js', '.mjs', '.cjs', '.map')) {
            if ($artifactPath -cnotin $allowedScripts) { throw "未核准的 JavaScript 產物：$artifactPath" }
            $scriptCount++
        }
        if ($file.Extension -ne '.html') { continue }
        $html = [IO.File]::ReadAllText($file.FullName)
        $pagePath = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
        $pageUrl = [uri]::new($BaseUrl, $pagePath)
        # Inspect actual tags only; code samples and data-* attributes are content.
        $html = [regex]::Replace($html, '<!--[\s\S]*?-->', '')
        $urls = [Collections.Generic.List[string]]::new()
        foreach ($tag in [regex]::Matches($html, '<(?<name>[a-zA-Z][a-zA-Z0-9:-]*)(?=[\s/>])(?:[^<>"'']|"[^"]*"|''[^'']*'')*>')) {
            $attributes = @{}
            foreach ($attribute in [regex]::Matches($tag.Value, '\s+(?<name>[^\s/>=]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|''(?<single>[^'']*)''|(?<bare>[^\s>]+)))?')) {
                $name = $attribute.Groups['name'].Value
                if ($name -match '^on[a-z]+$') { throw "HTML 含有 JavaScript 事件處理器：$($file.FullName)" }
                $value = if ($attribute.Groups['double'].Success) { $attribute.Groups['double'].Value } elseif ($attribute.Groups['single'].Success) { $attribute.Groups['single'].Value } else { $attribute.Groups['bare'].Value }
                $attributes[$name] = $value
            }
            if ($tag.Groups['name'].Value -ieq 'script') {
                if (-not $attributes.ContainsKey('src') -or [string]::IsNullOrWhiteSpace($attributes['src'])) {
                    throw "HTML 含有 inline JavaScript：$pagePath"
                }
                $scriptUrl = [uri]::new($pageUrl, [Net.WebUtility]::HtmlDecode($attributes['src']))
                if ($scriptUrl.Scheme -ne $BaseUrl.Scheme -or $scriptUrl.Authority -ne $BaseUrl.Authority) {
                    throw "HTML 含有遠端或非 HTTP JavaScript：$pagePath"
                }
                if ($scriptUrl.AbsolutePath -cne ($basePath + 'js/preferences.min.js')) {
                    throw "HTML 只能載入偏好控制器，沉浸模式須按需載入 JavaScript（含 base path）：$pagePath"
                }
                if (-not $attributes.ContainsKey('defer')) { throw "偏好 JavaScript 必須 defer：$pagePath" }
                $afterTag = $html.Substring($tag.Index + $tag.Length)
                if ($afterTag -notmatch '^\s*</script\s*>') { throw "HTML 含有 inline JavaScript 或未關閉 script：$pagePath" }
            }
            if ($attributes.ContainsKey('data-immersive-src')) {
                $immersiveUrl = [uri]::new($pageUrl, [Net.WebUtility]::HtmlDecode($attributes['data-immersive-src']))
                if ($immersiveUrl.Scheme -ne $BaseUrl.Scheme -or $immersiveUrl.Authority -ne $BaseUrl.Authority -or
                    $immersiveUrl.AbsolutePath -cne ($basePath + 'js/immersive.min.js')) {
                    throw "沉浸模式 JavaScript 必須使用核准的本地網址（含 base path）：$pagePath"
                }
                $urls.Add($attributes['data-immersive-src'])
            }
            if ($tag.Groups['name'].Value -ieq 'link' -and
                ($attributes['rel'] -match '(?i)(?:^|\s)modulepreload(?:\s|$)' -or
                 ($attributes['rel'] -match '(?i)(?:^|\s)preload(?:\s|$)' -and $attributes['as'] -ieq 'script'))) {
                throw "JavaScript 不得預載，沉浸模式須按需載入：$pagePath"
            }
            foreach ($name in @('href', 'src')) {
                if ($attributes.ContainsKey($name)) { $urls.Add($attributes[$name]) }
            }
            if ($tag.Groups['name'].Value -ieq 'meta' -and ($attributes['property'] -eq 'og:image' -or $attributes['name'] -eq 'twitter:image') -and $attributes.ContainsKey('content')) {
                $urls.Add($attributes['content'])
            }
        }
        foreach ($value in $urls) {
            $value = [Net.WebUtility]::HtmlDecode($value)
            if ($value -match '^\s*(?:javascript|vbscript):') { throw "HTML 含有 JavaScript URL：$($file.FullName)" }
            if ($value -eq '' -or $value.StartsWith('#')) { continue }
            $url = [uri]::new($pageUrl, $value)
            if ($url.Scheme -notin @('http', 'https') -or $url.Authority -ne $BaseUrl.Authority) { continue }
            if (-not $url.AbsolutePath.StartsWith($basePath, [StringComparison]::Ordinal)) {
                throw "站內網址漏掉 $basePath base path：$value ($pagePath)"
            }
            $relative = [uri]::UnescapeDataString($url.AbsolutePath.Substring($basePath.Length))
            $target = [IO.Path]::GetFullPath((Join-Path $root $relative))
            if ($target -ne $root -and -not $target.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::Ordinal)) {
                throw "站內連結超出網站目錄：$value"
            }
            if (Test-Path -LiteralPath $target -PathType Container) { $target = Join-Path $target 'index.html' }
            if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "站內連結缺少檔案：$value ($pagePath)" }
        }
    }
    foreach ($xmlName in @('index.xml', 'sitemap.xml')) {
        $settings = [Xml.XmlReaderSettings]::new()
        $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
        $reader = [Xml.XmlReader]::Create((Join-Path $root $xmlName), $settings)
        try { while ($reader.Read()) { } } finally { $reader.Dispose() }
    }
    return [pscustomobject]@{ FileCount = $files.Count; Bytes = $bytes; ScriptCount = $scriptCount; MaximumBytes = $maximumBytes }
}
