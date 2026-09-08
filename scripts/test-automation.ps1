#requires -Version 7.0

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'get-hugo.ps1')

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('self-blog-automation-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    # Fail before extraction: callers must still be able to acquire the lock.
    function Get-Hugo165OfficialChecksum { throw 'Fixture checksum failure' }
    $lockRoot = Join-Path $testRoot 'cache'
    try {
        Get-Hugo165 -Platform 'linux-amd64' -ToolCacheRoot $lockRoot | Out-Null
        throw 'Expected checksum failure.'
    } catch {
        if ($_.Exception.Message -ne 'Fixture checksum failure') { throw }
    }
    $lock = [IO.File]::Open((Join-Path $lockRoot '.hugo-cache.lock'), 'Open', 'ReadWrite', 'None')
    $lock.Dispose()
    Write-Host 'PASS: checksum failure releases the cache lock.'

    # This isolated repository has no remote, and verification always stops
    # publication before staging, committing, or pushing any article.
    $fixtureRoot = Join-Path $testRoot 'publish'
    $fixtureScripts = Join-Path $fixtureRoot 'scripts'
    New-Item -ItemType Directory -Path (Join-Path $fixtureScripts 'lib') -Force | Out-Null
    Copy-Item (Join-Path $PSScriptRoot 'publish.ps1') $fixtureScripts
    Copy-Item (Join-Path $PSScriptRoot 'lib/Common.ps1') (Join-Path $fixtureScripts 'lib')
    Set-Content (Join-Path $fixtureScripts 'verify.ps1') "throw 'FIXTURE_REACHED_VERIFY'"
    Invoke-NativeChecked git @('init', '-b', 'main', $fixtureRoot) | Out-Null
    Invoke-NativeChecked git @('-C', $fixtureRoot, 'add', 'scripts') | Out-Null
    Invoke-NativeChecked git @('-C', $fixtureRoot, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture') | Out-Null
    $contentDir = Join-Path $fixtureRoot 'content'
    New-Item -ItemType Directory -Path $contentDir | Out-Null
    Set-Content (Join-Path $contentDir '中文文章.md') 'fixture'
    $pwshPath = (Get-Process -Id $PID).Path
    $publishArgs = @('-NoProfile', '-File', (Join-Path $fixtureScripts 'publish.ps1'))
    $result = Invoke-ProcessNoWindow -FilePath $pwshPath -ArgumentList $publishArgs
    if ($result.ExitCode -eq 0 -or $result.Stderr -notmatch 'FIXTURE_REACHED_VERIFY') {
        throw "Chinese content filename failed before verification: $($result.Stdout) $($result.Stderr)"
    }
    Write-Host 'PASS: Chinese article filenames reach verification.'

    Set-Content (Join-Path $fixtureRoot '不應發布.txt') 'fixture'
    $result = Invoke-ProcessNoWindow -FilePath $pwshPath -ArgumentList $publishArgs
    if ($result.ExitCode -eq 0 -or $result.Stderr -notmatch '非內容變更') {
        throw "Non-content change was not rejected: $($result.Stdout) $($result.Stderr)"
    }
    Write-Host 'PASS: non-content changes remain blocked.'
} finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
