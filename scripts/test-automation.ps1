#requires -Version 7.0

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'get-hugo.ps1')

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('self-blog-automation-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    # Dot-sourced release helpers must locate the manifest beside the public
    # entry point, independent of the caller's current directory.
    Push-Location $testRoot
    try { $manifest = Get-Hugo165Manifest } finally { Pop-Location }
    $artifact = $manifest.Artifacts['linux-amd64']
    $checksumLine = "$($artifact.Sha256)  $($artifact.FileName)"
    $checksum = Get-Hugo165OfficialChecksum -Manifest $manifest -Platform 'linux-amd64' -ChecksumsText $checksumLine
    if ($checksum -ne $artifact.Sha256) { throw 'Pinned checksum lookup changed.' }
    try {
        Get-Hugo165OfficialChecksum -Manifest $manifest -Platform 'linux-amd64' -ChecksumsText "$checksumLine`n$checksumLine" | Out-Null
        throw 'Expected duplicate checksum rejection.'
    } catch {
        if ($_.Exception.Message -notmatch 'must contain exactly one entry') { throw }
    }
    Write-Host 'PASS: release metadata resolves from another working directory and rejects duplicate checksums.'

    # Exercise the archive/path boundary with a real ZIP on both host platforms.
    function New-ArchiveFixture([string]$Path, [string]$EntryName) {
        $zip = [IO.Compression.ZipFile]::Open($Path, [IO.Compression.ZipArchiveMode]::Create)
        try {
            $entry = $zip.CreateEntry($EntryName)
            $writer = [IO.StreamWriter]::new($entry.Open())
            try { $writer.Write('fixture binary') } finally { $writer.Dispose() }
        } finally { $zip.Dispose() }
    }
    $validZip = Join-Path $testRoot 'valid.zip'
    $validOutput = Join-Path $testRoot 'valid'
    New-ArchiveFixture $validZip 'nested/hugo'
    Expand-Hugo165ArchiveSafely -ArchivePath $validZip -Destination $validOutput
    if ([IO.File]::ReadAllText((Join-Path $validOutput 'nested/hugo')) -ne 'fixture binary') { throw 'Valid archive extraction changed.' }
    $unsafeZip = Join-Path $testRoot 'unsafe.zip'
    New-ArchiveFixture $unsafeZip '../escaped'
    try {
        Expand-Hugo165ArchiveSafely -ArchivePath $unsafeZip -Destination (Join-Path $testRoot 'unsafe')
        throw 'Expected archive path rejection.'
    } catch {
        if ($_.Exception.Message -notmatch 'Unsafe archive path') { throw }
    }
    if (Test-Path -LiteralPath (Join-Path $testRoot 'escaped')) { throw 'Archive wrote outside extraction root.' }
    Write-Host 'PASS: archive extraction preserves nested files and rejects traversal before writing.'

    $pwshPath = (Get-Process -Id $PID).Path
    $processFixture = Join-Path $testRoot 'process.ps1'
    Set-Content -LiteralPath $processFixture -Value @'
param([string]$Value)
# Match the UTF-8 producer contract used by publish.ps1 on windowless Windows.
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::Out.Write($Value)
[Console]::Error.Write('錯誤訊息')
exit 7
'@
    $argument = '中文 "quoted" argument'
    $result = Invoke-ProcessNoWindow -FilePath $pwshPath -ArgumentList @('-NoProfile', '-File', $processFixture, $argument)
    if ($result.ExitCode -ne 7 -or $result.Stdout -cne $argument -or $result.Stderr -cne '錯誤訊息') {
        throw "Process transport changed: $($result | ConvertTo-Json -Compress)"
    }
    Write-Host 'PASS: native process arguments, UTF-8 output, stderr and exit code survive the shared wrapper.'

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
    Copy-Item (Join-Path $PSScriptRoot 'lib/*') (Join-Path $fixtureScripts 'lib') -Recurse
    Set-Content (Join-Path $fixtureScripts 'verify.ps1') "throw 'FIXTURE_REACHED_VERIFY'"
    Invoke-NativeChecked git @('init', '-b', 'main', $fixtureRoot) | Out-Null
    Invoke-NativeChecked git @('-C', $fixtureRoot, 'add', 'scripts') | Out-Null
    Invoke-NativeChecked git @('-C', $fixtureRoot, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture') | Out-Null
    $contentDir = Join-Path $fixtureRoot 'content'
    New-Item -ItemType Directory -Path $contentDir | Out-Null
    Set-Content (Join-Path $contentDir '中文文章.md') 'fixture'
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
