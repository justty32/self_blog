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
. (Join-Path $PSScriptRoot 'lib/SiteValidation.ps1')

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

$configJson = Invoke-NativeChecked -FilePath $HugoPath -ArgumentList @('config', '--source', $repoRoot, '--environment', 'production', '--format', 'json') -ErrorMessage 'Cannot read Hugo configuration.'
$config = ($configJson -join "`n") | ConvertFrom-Json
$result = Assert-SiteArtifact -PublicDir $publicDir -BaseUrl $config.baseurl
Write-Host "VERIFY PASS — $($result.FileCount) files, $($result.Bytes) bytes, 0 JavaScript"
