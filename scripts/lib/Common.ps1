Set-StrictMode -Version Latest

function Get-NormalizedFullPath {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    return [System.IO.Path]::GetFullPath($Path)
}

function Test-FileSystemAttributesReparsePoint {
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.IO.FileAttributes]$Attributes)

    return (($Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
}

function Test-FileSystemItemReparsePoint {
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.IO.FileSystemInfo]$Item)

    return Test-FileSystemAttributesReparsePoint -Attributes $Item.Attributes
}

function Assert-SafePathWithinRoot {
    <#
      Validate a path before creating, deleting, or writing below it.  The
      lexical check alone is not sufficient: an attacker can pre-populate an
      ancestor with a symlink/junction and make a later operation leave Root.
      Existing components are inspected without following them and resolved
      containment is checked for every component that exists.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root
    )

    $fullPath = Get-NormalizedFullPath $Path
    $fullRoot = Get-NormalizedFullPath $Root
    $trimmedRoot = $fullRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $comparison = if ($IsWindows) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }
    if ($fullPath -ne $trimmedRoot -and -not $fullPath.StartsWith($trimmedRoot + [System.IO.Path]::DirectorySeparatorChar, $comparison)) {
        throw "Unsafe path '$Path' is outside root '$Root'."
    }

    $rootItem = $null
    try { $rootItem = Get-Item -LiteralPath $fullRoot -Force -ErrorAction Stop } catch { }
    $resolvedRoot = $null
    if ($null -ne $rootItem) {
        if (Test-FileSystemItemReparsePoint -Item $rootItem) { throw "Refusing reparse-point root '$fullRoot'." }
        $resolvedRoot = (Get-NormalizedFullPath (Resolve-Path -LiteralPath $fullRoot -ErrorAction Stop).Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    }

    $cursor = $fullPath
    while ($true) {
        $item = $null
        try { $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop } catch { }
        if ($null -ne $item) {
            if (Test-FileSystemItemReparsePoint -Item $item) { throw "Refusing reparse-point path component '$cursor'." }
            if ($null -ne $resolvedRoot) {
                $resolved = Get-NormalizedFullPath (Resolve-Path -LiteralPath $cursor -ErrorAction Stop).Path
                if ($resolved -ne $resolvedRoot -and -not $resolved.StartsWith($resolvedRoot + [System.IO.Path]::DirectorySeparatorChar, $comparison)) {
                    throw "Resolved path '$cursor' escapes root '$Root'."
                }
            }
        }
        if ($cursor -eq $trimmedRoot) { break }
        $parent = [System.IO.Path]::GetDirectoryName($cursor)
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $cursor) { break }
        $cursor = Get-NormalizedFullPath $parent
    }
    return $fullPath
}

function Assert-SafeDirectoryTree {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $root = Get-Item -LiteralPath (Get-NormalizedFullPath $Path) -Force -ErrorAction Stop
    if (-not $root.PSIsContainer) { throw "Expected directory '$Path'." }
    if (Test-FileSystemItemReparsePoint -Item $root) { throw "Refusing reparse-point directory '$Path'." }
    foreach ($item in @(Get-ChildItem -LiteralPath $root.FullName -Force -Recurse -ErrorAction Stop)) {
        if (Test-FileSystemItemReparsePoint -Item $item) { throw "Refusing reparse-point tree entry '$($item.FullName)'." }
    }
}

function Ensure-SafeDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root
    )

    [void](Assert-SafePathWithinRoot -Path $Path -Root $Root)
    New-Item -ItemType Directory -Path (Get-NormalizedFullPath $Path) -Force -ErrorAction Stop | Out-Null
    [void](Assert-SafePathWithinRoot -Path $Path -Root $Root)
    Assert-SafeDirectoryTree -Path $Path
}

function Test-PathWithinRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root
    )

    $fullPath = Get-NormalizedFullPath $Path
    $fullRoot = (Get-NormalizedFullPath $Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    if ($fullPath -eq $fullRoot) { return $true }
    $prefix = $fullRoot + [System.IO.Path]::DirectorySeparatorChar
    $comparison = if ($IsWindows) {
        [System.StringComparison]::OrdinalIgnoreCase
    }
    else {
        [System.StringComparison]::Ordinal
    }
    return $fullPath.StartsWith($prefix, $comparison)
}

function Resolve-SafeChildPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "Unsafe archive path '$RelativePath'."
    }
    $parts = $RelativePath -split '[\\/]'
    if ($parts | Where-Object { $_ -eq '..' }) {
        throw "Unsafe archive path '$RelativePath'."
    }
    $candidate = Join-Path $Root ($parts -join [System.IO.Path]::DirectorySeparatorChar)
    if (-not (Test-PathWithinRoot -Path $candidate -Root $Root)) {
        throw "Archive path escapes extraction root: '$RelativePath'."
    }
    return Get-NormalizedFullPath $candidate
}

function Get-Sha256Hex {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$LiteralPath)

    if (-not (Test-Path -LiteralPath $LiteralPath -PathType Leaf)) {
        throw "Expected file does not exist: $LiteralPath"
    }
    return (Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-ProcessNoWindow {
    <#
      Run a native process without allocating a console window. This matters on
      Windows when the parent process itself has no attached console: a direct
      `& pwsh ...` invocation can otherwise flash a new PowerShell window for
      every fixture case.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = (Get-Location).Path,
        [hashtable]$Environment = @{}
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $startInfo.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
    foreach ($argument in @($ArgumentList)) {
        if ($null -ne $argument) { [void]$startInfo.ArgumentList.Add([string]$argument) }
    }
    foreach ($entry in $Environment.GetEnumerator()) {
        $startInfo.Environment[$entry.Key] = [string]$entry.Value
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) { throw "Unable to start process: $FilePath" }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            Stdout   = $stdoutTask.GetAwaiter().GetResult()
            Stderr   = $stderrTask.GetAwaiter().GetResult()
        }
    }
    finally {
        $process.Dispose()
    }
}

function Get-ProcessOutputLines {
    [CmdletBinding()]
    param([AllowEmptyString()][string]$Text)

    if ([string]::IsNullOrEmpty($Text)) { return @() }
    return @($Text -split "`r?`n" | Where-Object { $_ -ne '' })
}

function Invoke-NativeChecked {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$ErrorMessage = 'Native command failed.'
    )

    $result = Invoke-ProcessNoWindow -FilePath $FilePath -ArgumentList $ArgumentList
    $output = @(Get-ProcessOutputLines ($result.Stdout + $result.Stderr))
    if ($result.ExitCode -ne 0) {
        throw "$ErrorMessage Exit code: $($result.ExitCode). Output: $($output -join [Environment]::NewLine)"
    }
    return @($output)
}
