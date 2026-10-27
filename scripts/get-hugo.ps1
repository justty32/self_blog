[CmdletBinding()]
param(
    [string]$Platform = '',
    [string]$ToolCacheRoot = ''
)

Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'lib/Common.ps1')

. (Join-Path $PSScriptRoot 'lib/HugoRelease.ps1')
. (Join-Path $PSScriptRoot 'lib/HugoArchive.ps1')
. (Join-Path $PSScriptRoot 'lib/HugoCache.ps1')

if ($MyInvocation.InvocationName -ne '.') {
    $parameters = @{}
    if (-not [string]::IsNullOrWhiteSpace($Platform)) { $parameters.Platform = $Platform }
    if (-not [string]::IsNullOrWhiteSpace($ToolCacheRoot)) { $parameters.ToolCacheRoot = $ToolCacheRoot }
    Get-Hugo165 @parameters
}
