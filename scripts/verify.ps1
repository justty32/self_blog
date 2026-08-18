#requires -Version 7.0

[CmdletBinding()]
param(
    [string]$HugoPath = '',
    [string]$ToolCacheRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
. (Join-Path $PSScriptRoot 'lib/Common.ps1')
. (Join-Path $PSScriptRoot 'get-hugo.ps1')

if ([string]::IsNullOrWhiteSpace($HugoPath)) {
    $HugoPath = Get-Hugo165 -ToolCacheRoot $ToolCacheRoot
}
if (-not (Test-Path -LiteralPath $HugoPath -PathType Leaf)) {
    throw "找不到 Hugo：$HugoPath"
}

$publicDir = Join-Path $repoRoot 'public'
$buildArgs = @(
    '--source', $repoRoot,
    '--environment', 'production',
    '--destination', $publicDir,
    '--cleanDestinationDir',
    '--minify',
    '--noBuildLock'
)
$buildOutput = Invoke-NativeChecked -FilePath $HugoPath -ArgumentList $buildArgs -ErrorMessage 'Hugo build failed.'
$buildOutput | ForEach-Object { Write-Host $_ }

foreach ($required in @(
    'index.html',
    'posts/index.html',
    'posts/hello-world/index.html',
    'posts/2026/hello-world/index.html',
    'tags/index.html',
    'archive/index.html',
    'about/index.html',
    'contact/index.html',
    'index.xml',
    'sitemap.xml',
    'robots.txt',
    '404.html',
    'css/site.css',
    'social-preview.jpg'
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $publicDir $required) -PathType Leaf)) {
        throw "建置缺少必要檔案：public/$required"
    }
}

$scriptFiles = @(Get-ChildItem -LiteralPath $publicDir -Recurse -File | Where-Object {
    $_.Extension -in @('.js', '.mjs', '.cjs', '.map')
})
if ($scriptFiles.Count -gt 0) {
    throw "讀者端不得包含 JavaScript：$($scriptFiles[0].FullName)"
}

foreach ($html in Get-ChildItem -LiteralPath $publicDir -Recurse -File -Filter '*.html') {
    $text = [System.IO.File]::ReadAllText($html.FullName)
    if ($text -match '(?i)<script\b' -or $text -match '(?i)\son[a-z]+\s*=') {
        throw "HTML 含有 JavaScript 或事件處理器：$($html.FullName)"
    }
    if ($text -match '(?i)(?:href|src)\s*=\s*["'']/((?!self_blog(?:/|["'']))[^"'']*)') {
        throw "站內網址漏掉 /self_blog/ base path：$($html.FullName)"
    }
}

$files = @(Get-ChildItem -LiteralPath $publicDir -Recurse -File)
$bytes = ($files | Measure-Object -Property Length -Sum).Sum
Write-Host "VERIFY PASS — $($files.Count) files, $bytes bytes, 0 JavaScript"
