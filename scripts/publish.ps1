#requires -Version 7.0

[CmdletBinding()]
param([string]$Message = '')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# A windowless Windows process may otherwise encode redirected diagnostics as
# ASCII. Match the UTF-8 readers used by Invoke-ProcessNoWindow.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
. (Join-Path $PSScriptRoot 'lib/Common.ps1')

function Invoke-Git {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $result = Invoke-ProcessNoWindow -FilePath 'git' -ArgumentList (@('-C', $repoRoot) + $Arguments) -WorkingDirectory $repoRoot
    if ($result.ExitCode -ne 0) {
        throw "git $($Arguments -join ' ') 失敗：$($result.Stderr.Trim())"
    }
    if (-not [string]::IsNullOrWhiteSpace($result.Stdout)) { Write-Host $result.Stdout.TrimEnd() }
    if (-not [string]::IsNullOrWhiteSpace($result.Stderr)) { Write-Host $result.Stderr.TrimEnd() }
    return $result.Stdout.Trim()
}

$branch = Invoke-Git @('branch', '--show-current')
if ($branch -cne 'main') { throw "發布只允許從 main branch 執行；目前是 '$branch'。" }

$staged = @((Invoke-Git @('diff', '--cached', '--name-only', '-z', '--')) -split "`0" | Where-Object { $_ })
if ($staged.Count -gt 0) { throw '請先處理既有 staged 變更，再執行發布。' }

$trackedChanges = @(
    (Invoke-Git @('diff', '--name-only', '-z', '--')) -split "`0" | Where-Object { $_ }
    (Invoke-Git @('ls-files', '--others', '--exclude-standard', '-z')) -split "`0" | Where-Object { $_ }
)
$outsideContent = @($trackedChanges | Where-Object { -not $_.StartsWith('content/', [StringComparison]::Ordinal) })
if ($outsideContent.Count -gt 0) {
    throw "發布文章前請先另外提交非內容變更：$($outsideContent -join ', ')"
}
if ($trackedChanges.Count -eq 0) { throw 'content/ 沒有需要發布的變更。' }

& (Join-Path $PSScriptRoot 'verify.ps1')

Invoke-Git @('add', '-A', '--', 'content') | Out-Null
Invoke-Git @('diff', '--cached', '--check', '--') | Out-Null
if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = 'content: publish post'
}
Invoke-Git @('commit', '-m', $Message) | Out-Null
Invoke-Git @('push', 'origin', 'HEAD:main') | Out-Null
Write-Host '發布完成。GitHub Actions 會建置並部署網站。'
