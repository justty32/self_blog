#requires -Version 7.0
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib/SiteValidation.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('self-blog-site-test-' + [guid]::NewGuid().ToString('N'))
$baseUrl = [uri]'https://example.invalid/blog/'
function Write-Fixture([string]$Path, [string]$Text) {
    $fullPath = Join-Path $testRoot $Path
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($fullPath))
    [IO.File]::WriteAllText($fullPath, $Text)
}
function Assert-Rejected([string]$Name, [string]$Expected) {
    $failure = $null
    try { Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl | Out-Null } catch { $failure = $_.Exception.Message }
    if ($null -eq $failure -or $failure -notmatch $Expected) { throw "$Name did not fail as expected: $failure" }
    Write-Host "PASS: $Name"
}
try {
    Write-Fixture 'css/site.css' 'body { color: black; }'
    Write-Fixture 'index.xml' '<rss><channel /></rss>'
    Write-Fixture 'sitemap.xml' '<urlset />'
    Write-Fixture 'robots.txt' 'User-agent: *'
    Write-Fixture '404.html' '<a href=/blog/>Home</a>'
    Write-Fixture 'notes/index.html' '<p>Article independent of seed filename.</p>'
    $validHtml = '<link href=/blog/css/site.css rel=stylesheet><a href="/blog/notes/">Article</a><a href=''https://example.invalid/blog/notes/?q=1&amp;x=2''>Absolute</a><a href=https://elsewhere.invalid/>External</a>'
    Write-Fixture 'index.html' $validHtml
    Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl | Out-Null
    Write-Host 'PASS: quoted/unquoted links, configurable base and arbitrary article routes.'
    Write-Fixture 'js/preferences.min.js' '/* Local preference controller. */'
    Write-Fixture 'js/immersive.min.js' 'export function start() {}'
    $validScript = '<script defer src=/blog/js/preferences.min.js data-immersive-src=/blog/js/immersive.min.js></script>'
    Write-Fixture 'index.html' ($validHtml + $validScript)
    $result = Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl
    if ($result.ScriptCount -ne 2 -or $result.MaximumBytes -ne 5000000) { throw 'Wrong script count or size budget.' }
    Write-Host 'PASS: approved deferred controller and opt-in module URL.'
    Write-Fixture 'index.html' '<script defer src="https://example.invalid/blog/js/preferences.min.js"></script>'
    Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl | Out-Null
    Write-Host 'PASS: same-origin absolute controller URL.'
    foreach ($badScript in @(
        '<script src=/blog/js/preferences.min.js></script>',
        '<script defer src=/blog/js/preferences.min.js>alert(1)</script>',
        '<script defer src=/blog/js/preferences.min.js>',
        '<script defer src=/blog/js/immersive.min.js></script>',
        '<script defer src=https://cdn.invalid/preferences.min.js></script>',
        '<script defer src=//cdn.invalid/preferences.min.js></script>',
        '<script defer src=data:text/javascript,alert(1)></script>',
        '<script defer src=/js/preferences.min.js></script>',
        '<script defer src=/blog/js/unreviewed.js></script>',
        '<link rel=modulepreload href=/blog/js/immersive.min.js>',
        '<link rel=preload as=script href=/blog/js/immersive.min.js>',
        '<script defer src=/blog/js/preferences.min.js data-immersive-src=https://cdn.invalid/immersive.min.js></script>',
        '<script defer src=/blog/js/preferences.min.js data-immersive-src=/js/immersive.min.js></script>'
    )) {
        Write-Fixture 'index.html' $badScript
        Assert-Rejected "Disallowed script: $badScript" 'JavaScript|script'
    }
    Write-Fixture 'index.html' $validScript
    Remove-Item -LiteralPath (Join-Path $testRoot 'js/immersive.min.js')
    Assert-Rejected 'Missing deferred immersive asset' '缺少檔案'
    Write-Fixture 'js/immersive.min.js' 'export function start() {}'
    Remove-Item -LiteralPath (Join-Path $testRoot 'js/preferences.min.js')
    Assert-Rejected 'Missing controller asset' '缺少檔案'
    Write-Fixture 'js/preferences.min.js' '/* Local preference controller. */'
    Write-Fixture 'index.html' '<p>Set <code>href=/about/ src=/sample.png onclick=example</code> in a template.</p><div data-href=/about/ title="Example href=/about/ > text">Content</div><!-- <a href=/about/>comment</a> -->'
    Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl | Out-Null
    Write-Host 'PASS: code samples, comments, data attributes and quoted tag delimiters are content.'
    Write-Fixture 'index.html' '<meta property=og:image content=https://example.invalid/blog/missing.jpg>'
    Assert-Rejected 'Missing configured social image' '缺少檔案'
    Write-Fixture 'index.html' '<div onclick="alert(1)">bad</div>'
    Assert-Rejected 'Event handler' 'JavaScript'


    foreach ($badLink in @('<a href=/notes/>bad</a>', '<a href="/notes/">bad</a>', "<a href='/notes/'>bad</a>", '<a href=https://example.invalid/notes/>bad</a>')) {
        Write-Fixture 'index.html' $badLink
        Assert-Rejected 'Missing project base' 'base path'
    }
    Write-Fixture 'index.html' '<img src=/blog/missing.png>'
    Assert-Rejected 'Missing local asset' '缺少檔案'
    Write-Fixture 'index.html' '<script>alert(1)</script>'
    Assert-Rejected 'Inline script' 'JavaScript'
    Write-Fixture 'index.html' '<a href="javascript:alert(1)">bad</a>'
    Assert-Rejected 'JavaScript URL' 'JavaScript'
    Write-Fixture 'index.html' '<a href="&#106;avascript:alert(1)">bad</a>'
    Assert-Rejected 'Entity-encoded JavaScript URL' 'JavaScript'
    Write-Fixture 'index.html' $validHtml
    Write-Fixture 'runtime.js' 'alert(1)'
    Assert-Rejected 'JavaScript artifact' 'JavaScript'
    Remove-Item -LiteralPath (Join-Path $testRoot 'runtime.js')
    foreach ($artifact in @('js/vendor.js', 'js/preferences.js', 'js/immersive.mjs', 'js/preferences.min.js.map')) {
        Write-Fixture $artifact '/* Unapproved runtime or source map. */'
        Assert-Rejected "Unapproved artifact: $artifact" 'JavaScript'
        Remove-Item -LiteralPath (Join-Path $testRoot $artifact)
    }
    $baseSize = (Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl).Bytes
    $paddingPath = Join-Path $testRoot 'padding.bin'
    [IO.File]::WriteAllBytes($paddingPath, [byte[]]::new(5000000 - $baseSize))
    if ((Assert-SiteArtifact -PublicDir $testRoot -BaseUrl $baseUrl).Bytes -ne 5000000) { throw 'Size boundary did not match.' }
    Write-Host 'PASS: artifact exactly at 5 MB budget.'
    $stream = [IO.File]::OpenWrite($paddingPath)
    try { [void]$stream.Seek(0, [IO.SeekOrigin]::End); $stream.WriteByte(0) } finally { $stream.Dispose() }
    Assert-Rejected 'Artifact over 5 MB budget by one byte' '5 MB'
    Remove-Item -LiteralPath $paddingPath
    Write-Fixture 'sitemap.xml' '<urlset>'
    Assert-Rejected 'Malformed sitemap' 'XML|end|結尾|結束'
    Write-Fixture 'sitemap.xml' '<urlset />'
    Remove-Item -LiteralPath (Join-Path $testRoot 'css/site.css')
    Assert-Rejected 'Missing shared stylesheet' '必要檔案'
    Write-Host 'SITE VALIDATION TESTS PASS'
} finally {
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
