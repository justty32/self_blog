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
    foreach ($file in $files) {
        if ($file.Extension -in @('.js', '.mjs', '.cjs', '.map')) { throw "讀者端不得包含 JavaScript：$($file.FullName)" }
        if ($file.Extension -ne '.html') { continue }
        $html = [IO.File]::ReadAllText($file.FullName)
        $pagePath = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
        $pageUrl = [uri]::new($BaseUrl, $pagePath)
        # Inspect actual tags only; code samples and data-* attributes are content.
        $html = [regex]::Replace($html, '<!--[\s\S]*?-->', '')
        $urls = [Collections.Generic.List[string]]::new()
        foreach ($tag in [regex]::Matches($html, '<(?<name>[a-zA-Z][a-zA-Z0-9:-]*)(?=[\s/>])(?:[^<>"'']|"[^"]*"|''[^'']*'')*>')) {
            if ($tag.Groups['name'].Value -ieq 'script') { throw "HTML 含有 JavaScript：$($file.FullName)" }
            $attributes = @{}
            foreach ($attribute in [regex]::Matches($tag.Value, '\s+(?<name>[^\s/>=]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|''(?<single>[^'']*)''|(?<bare>[^\s>]+)))?')) {
                $name = $attribute.Groups['name'].Value
                if ($name -match '^on[a-z]+$') { throw "HTML 含有 JavaScript 事件處理器：$($file.FullName)" }
                $value = if ($attribute.Groups['double'].Success) { $attribute.Groups['double'].Value } elseif ($attribute.Groups['single'].Success) { $attribute.Groups['single'].Value } else { $attribute.Groups['bare'].Value }
                $attributes[$name] = $value
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
    return [pscustomobject]@{ FileCount = $files.Count; Bytes = ($files | Measure-Object -Property Length -Sum).Sum }
}
