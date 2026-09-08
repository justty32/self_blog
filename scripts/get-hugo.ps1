[CmdletBinding()]
param(
    [string]$Platform = '',
    [string]$ToolCacheRoot = ''
)

Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'lib/Common.ps1')

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
    return Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot 'Hugo-165.psd1')
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

function Assert-Hugo165ArchiveEntryPath {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$EntryName)
    if ([string]::IsNullOrWhiteSpace($EntryName) -or $EntryName.StartsWith('/') -or $EntryName.StartsWith('\\') -or $EntryName -match '^[A-Za-z]:') {
        throw "Unsafe archive entry '$EntryName'."
    }
    [void](Resolve-SafeChildPath -Root ([System.IO.Path]::GetTempPath()) -RelativePath $EntryName)
}

function Expand-Hugo165ArchiveSafely {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ArchivePath,
        [Parameter(Mandatory)][string]$Destination
    )

    $destinationRoot = Get-NormalizedFullPath $Destination
    # Extraction always happens in a freshly-created private staging tree.  The
    # check is still kept here so this function remains safe when called on its
    # own and cannot be redirected by a pre-existing link/junction.
    $destinationParent = [System.IO.Path]::GetDirectoryName($destinationRoot)
    [void](Assert-SafePathWithinRoot -Path $destinationRoot -Root $destinationParent)
    Ensure-SafeDirectory -Path $destinationRoot -Root $destinationParent
    if ($ArchivePath.EndsWith('.zip', [System.StringComparison]::OrdinalIgnoreCase)) {
        Add-Type -AssemblyName System.IO.Compression | Out-Null
        $zip = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
        try {
            foreach ($entry in $zip.Entries) {
                Assert-Hugo165ArchiveEntryPath $entry.FullName
                # ZIP can encode a POSIX symlink as a regular-looking entry. Do not
                # let an archive redirect a write outside the validated tree.
                if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) {
                    throw "Refusing symbolic-link ZIP entry '$($entry.FullName)'."
                }
                $outputPath = Resolve-SafeChildPath -Root $destinationRoot -RelativePath $entry.FullName
                [void](Assert-SafePathWithinRoot -Path $outputPath -Root $destinationRoot)
                if ($entry.FullName.EndsWith('/')) { Ensure-SafeDirectory -Path $outputPath -Root $destinationRoot; continue }
                Ensure-SafeDirectory -Path ([System.IO.Path]::GetDirectoryName($outputPath)) -Root $destinationRoot
                $entryStream = $entry.Open(); try { $out = [System.IO.File]::Create($outputPath); try { $entryStream.CopyTo($out) } finally { $out.Dispose() } } finally { $entryStream.Dispose() }
            }
        } finally { $zip.Dispose() }
        return
    }

    $tarReaderType = [type]::GetType('System.Formats.Tar.TarReader, System.Formats.Tar', $false)
    if ($null -eq $tarReaderType) { throw 'Safe tar extraction requires System.Formats.Tar (PowerShell 7 on .NET 7 or newer).' }
    $input = [System.IO.File]::OpenRead($ArchivePath)
    try {
        $gzip = [System.IO.Compression.GZipStream]::new($input, [System.IO.Compression.CompressionMode]::Decompress)
        try {
            $reader = [System.Formats.Tar.TarReader]::new($gzip, $false)
            try {
                while ($null -ne ($entry = $reader.GetNextEntry())) {
                    Assert-Hugo165ArchiveEntryPath $entry.Name
                    $outputPath = Resolve-SafeChildPath -Root $destinationRoot -RelativePath $entry.Name
                    [void](Assert-SafePathWithinRoot -Path $outputPath -Root $destinationRoot)
                    if ($entry.EntryType.ToString() -eq 'Directory') { Ensure-SafeDirectory -Path $outputPath -Root $destinationRoot; continue }
                    if ($entry.EntryType.ToString() -notin @('RegularFile', 'V7RegularFile', 'ContiguousFile')) { throw "Refusing non-regular tar entry '$($entry.Name)' ($($entry.EntryType))." }
                    Ensure-SafeDirectory -Path ([System.IO.Path]::GetDirectoryName($outputPath)) -Root $destinationRoot
                    $output = [System.IO.File]::Create($outputPath)
                    try { $entry.DataStream.CopyTo($output) } finally { $output.Dispose() }
                }
            } finally { $reader.Dispose() }
        } finally { $gzip.Dispose() }
    } finally { $input.Dispose() }
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

function Enter-HugoCacheLock {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$LockPath)

    $normalized = Get-NormalizedFullPath $LockPath
    $existing = $null
    try { $existing = Get-Item -LiteralPath $normalized -Force -ErrorAction Stop } catch { }
    if ($null -ne $existing -and (Test-FileSystemItemReparsePoint -Item $existing)) { throw "Refusing reparse-point Hugo cache lock '$normalized'." }
    for ($attempt = 0; $attempt -lt 600; $attempt++) {
        try {
            return [System.IO.File]::Open($normalized, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        } catch [System.IO.IOException] {
            Start-Sleep -Milliseconds 100
        }
    }
    throw "Timed out waiting for Hugo cache lock '$normalized'."
}

function Get-Hugo165 {
    [CmdletBinding()]
    param(
        [string]$Platform = (Get-Hugo165Platform),
        [string]$ToolCacheRoot = ''
    )

    $manifest = Get-Hugo165Manifest
    if (-not $manifest.Artifacts.ContainsKey($Platform)) { throw "Unsupported Hugo platform '$Platform'." }
    $artifact = $manifest.Artifacts[$Platform]
    if ([string]::IsNullOrWhiteSpace($ToolCacheRoot)) {
        $ToolCacheRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'self-blog-hugo-cache'
    }
    $toolRoot = Get-NormalizedFullPath $ToolCacheRoot
    # Keep private staging on the cache volume so promotion works even when
    # a caller-selected cache is on a different drive from the OS temp folder.
    [void](Assert-SafePathWithinRoot -Path $toolRoot -Root $toolRoot)
    $toolRootParent = [System.IO.Path]::GetDirectoryName($toolRoot)
    Ensure-SafeDirectory -Path $toolRoot -Root $toolRootParent
    $cacheLockPath = Join-Path $toolRoot '.hugo-cache.lock'
    [void](Assert-SafePathWithinRoot -Path $cacheLockPath -Root $toolRoot)
    $cacheLock = Enter-HugoCacheLock -LockPath $cacheLockPath
    $stageRoot = $null
    try {
        $cacheDir = Join-Path $toolRoot (Join-Path $manifest.Version 'archives')
        $toolsDir = Join-Path $toolRoot (Join-Path $manifest.Version (Join-Path 'tools' $Platform))
        $archivePath = Join-Path $cacheDir $artifact.FileName
        $binaryPath = Join-Path $toolsDir $artifact.BinaryName

        Ensure-SafeDirectory -Path $cacheDir -Root $toolRoot
        [void](Assert-SafePathWithinRoot -Path $archivePath -Root $toolRoot)
        $officialSha = Get-Hugo165OfficialChecksum -Manifest $manifest -Platform $Platform

        # A valid cached installation is immutable input for this project. Reusing
        # it avoids needless extraction and also permits `verify.ps1` to run while
        # the same Hugo binary is serving a local preview on Windows.
        if ((Test-Path -LiteralPath $archivePath -PathType Leaf) -and
            (Test-Path -LiteralPath $binaryPath -PathType Leaf)) {
            Assert-SafeDirectoryTree -Path $toolsDir
            Assert-Hugo165ArchiveHash -ArchivePath $archivePath -ExpectedSha256 $officialSha
            Assert-Hugo165Version -BinaryPath $binaryPath -Platform $Platform | Out-Null
            return $binaryPath
        }

        $stageRoot = Join-Path $toolRoot ("self-blog-hugo-stage-{0}" -f [guid]::NewGuid().ToString('N'))
        [void](Assert-SafePathWithinRoot -Path $stageRoot -Root $toolRoot)
        New-Item -ItemType Directory -Path $stageRoot -ErrorAction Stop | Out-Null
        [void](Assert-SafePathWithinRoot -Path $stageRoot -Root $toolRoot)
        if ($IsLinux) { [System.IO.File]::SetUnixFileMode($stageRoot, [System.IO.UnixFileMode]::UserRead -bor [System.IO.UnixFileMode]::UserWrite -bor [System.IO.UnixFileMode]::UserExecute) }
        $stageArchive = Join-Path $stageRoot $artifact.FileName
        $archiveItem = $null
        try { $archiveItem = Get-Item -LiteralPath $archivePath -Force -ErrorAction Stop } catch { }
        if ($null -ne $archiveItem) {
            if ($archiveItem.PSIsContainer -or (Test-FileSystemItemReparsePoint -Item $archiveItem)) { throw "Refusing unsafe pre-existing Hugo archive '$archivePath'." }
        }
        if ($null -eq $archiveItem) {
            Invoke-WebRequest -Uri "$($manifest.ReleaseBaseUrl)/$($artifact.FileName)" -OutFile $stageArchive -ErrorAction Stop
            Assert-Hugo165ArchiveHash -ArchivePath $stageArchive -ExpectedSha256 $officialSha
            [void](Assert-SafePathWithinRoot -Path $archivePath -Root $toolRoot)
            try { [System.IO.File]::Move($stageArchive, $archivePath) } catch {
                # A concurrent creator is acceptable only if it is itself safe;
                # the hash check below remains authoritative.
                $raced = Get-Item -LiteralPath $archivePath -Force -ErrorAction Stop
                if ($raced.PSIsContainer -or (Test-FileSystemItemReparsePoint -Item $raced)) { throw "Refusing unsafe pre-existing Hugo archive '$archivePath'." }
            }
        }
        Assert-Hugo165ArchiveHash -ArchivePath $archivePath -ExpectedSha256 $officialSha

        # Re-extract from the hash-verified archive in staging.  Existing tools
        # are never recursively deleted until their complete tree is proven to
        # contain no reparse points, and promotion is a same-volume rename.
        $stageTools = Join-Path $stageRoot 'tools'
        Ensure-SafeDirectory -Path $stageTools -Root $stageRoot
        Expand-Hugo165ArchiveSafely -ArchivePath $archivePath -Destination $stageTools
        $stageBinary = Join-Path $stageTools $artifact.BinaryName
        $stageBinaryItem = Get-Item -LiteralPath $stageBinary -Force -ErrorAction Stop
        if ($stageBinaryItem.PSIsContainer -or (Test-FileSystemItemReparsePoint -Item $stageBinaryItem)) { throw "Verified Hugo archive contained an unsafe binary '$($artifact.BinaryName)'." }
        if ($IsLinux) {
            [System.IO.File]::SetUnixFileMode(
                $stageBinary,
                [System.IO.UnixFileMode]::UserRead -bor [System.IO.UnixFileMode]::UserWrite -bor [System.IO.UnixFileMode]::UserExecute -bor
                [System.IO.UnixFileMode]::GroupRead -bor [System.IO.UnixFileMode]::GroupExecute -bor
                [System.IO.UnixFileMode]::OtherRead -bor [System.IO.UnixFileMode]::OtherExecute
            )
        }
        Assert-Hugo165Version -BinaryPath $stageBinary -Platform $Platform | Out-Null
        Assert-SafeDirectoryTree -Path $stageTools

        $toolsParent = [System.IO.Path]::GetDirectoryName($toolsDir)
        Ensure-SafeDirectory -Path $toolsParent -Root $toolRoot
        $oldTools = "$toolsDir.old-$([guid]::NewGuid().ToString('N'))"
        $hadOldTools = $false
        $existingTools = $null
        try { $existingTools = Get-Item -LiteralPath $toolsDir -Force -ErrorAction Stop } catch { }
        if ($null -ne $existingTools) {
            if (-not $existingTools.PSIsContainer) { throw "Refusing unsafe pre-existing tools path '$toolsDir'." }
            Assert-SafeDirectoryTree -Path $toolsDir
            [System.IO.Directory]::Move($toolsDir, $oldTools)
            $hadOldTools = $true
        }
        try {
            [System.IO.Directory]::Move($stageTools, $toolsDir)
        } catch {
            if ($hadOldTools -and -not (Test-Path -LiteralPath $toolsDir) -and (Test-Path -LiteralPath $oldTools)) { [System.IO.Directory]::Move($oldTools, $toolsDir) }
            throw
        }
        if ($hadOldTools) {
            Assert-SafeDirectoryTree -Path $oldTools
            Remove-Item -LiteralPath $oldTools -Recurse -Force -ErrorAction Stop
        }
        $binaryPath = Join-Path $toolsDir $artifact.BinaryName
        return $binaryPath
    }
    finally {
        if ($null -ne $cacheLock) { $cacheLock.Dispose() }
        if ($null -ne $stageRoot -and (Test-Path -LiteralPath $stageRoot -PathType Container)) {
            Assert-SafeDirectoryTree -Path $stageRoot
            Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction Stop
        }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    $parameters = @{}
    if (-not [string]::IsNullOrWhiteSpace($Platform)) { $parameters.Platform = $Platform }
    if (-not [string]::IsNullOrWhiteSpace($ToolCacheRoot)) { $parameters.ToolCacheRoot = $ToolCacheRoot }
    Get-Hugo165 @parameters
}
