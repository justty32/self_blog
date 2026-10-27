Set-StrictMode -Version Latest

function Get-Hugo165Platform {
    [CmdletBinding()]
    param()

    $os = if ($IsWindows) { 'windows' } elseif ($IsLinux) { 'linux' } else { throw "Unsupported operating system. Only Windows and Linux are supported." }
    if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -ne [System.Runtime.InteropServices.Architecture]::X64) {
        throw "Unsupported CPU architecture. Hugo v0.165.0 gate supports amd64 only."
    }
    return "$os-amd64"
}

function Get-Hugo165Manifest {
    [CmdletBinding()]
    param()
    return Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot '../Hugo-165.psd1')
}

function Get-Hugo165OfficialChecksum {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable]$Manifest,
        [Parameter(Mandatory)][string]$Platform,
        [string]$ChecksumsText
    )

    if (-not $Manifest.Artifacts.ContainsKey($Platform)) { throw "Unsupported Hugo platform '$Platform'." }
    $artifact = $Manifest.Artifacts[$Platform]
    if ([string]::IsNullOrEmpty($ChecksumsText)) {
        $response = Invoke-WebRequest -Uri $Manifest.ChecksumsUrl -ErrorAction Stop
        $ChecksumsText = if ($response.Content -is [byte[]]) {
            [System.Text.Encoding]::UTF8.GetString([byte[]]$response.Content)
        } else {
            [string]$response.Content
        }
    }
    $matches = @($ChecksumsText -split "`r?`n" | Where-Object { $_ -match ('^(?<sha>[0-9A-Fa-f]{64})\s+\*?' + [regex]::Escape($artifact.FileName) + '\s*$') })
    if ($matches.Count -ne 1) { throw "Official checksums manifest must contain exactly one entry for $($artifact.FileName); found $($matches.Count)." }
    $officialSha = ([regex]::Match($matches[0], '^(?<sha>[0-9A-Fa-f]{64})')).Groups['sha'].Value.ToLowerInvariant()
    if ($officialSha -ne $artifact.Sha256.ToLowerInvariant()) {
        throw "Pinned SHA-256 for $($artifact.FileName) disagrees with the official checksums manifest."
    }
    return $officialSha
}

function Assert-Hugo165ArchiveHash {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ArchivePath,
        [Parameter(Mandatory)][string]$ExpectedSha256
    )
    $actual = Get-Sha256Hex -LiteralPath $ArchivePath
    if ($actual -ne $ExpectedSha256.ToLowerInvariant()) { throw "Hugo archive SHA-256 mismatch. Expected $ExpectedSha256, got $actual." }
}

function Assert-Hugo165Version {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$BinaryPath,
        [Parameter(Mandatory)][string]$Platform
    )
    $version = (Invoke-NativeChecked -FilePath $BinaryPath -ArgumentList @('version') -ErrorMessage 'Hugo version check failed') -join "`n"
    $platformToken = $Platform -replace '-', '/'
    # Standard Hugo does not print a '+standard' marker. The exact verified Standard
    # archive is the edition proof; '+extended' would prove the wrong edition.
    if ($version -notmatch 'hugo v0\.165\.0-' -or $version -notmatch ([regex]::Escape($platformToken)) -or $version -match '(?i)\+extended') {
        throw "Unexpected Hugo version output for ${Platform}: $version"
    }
    return $version
}
