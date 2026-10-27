Set-StrictMode -Version Latest

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
