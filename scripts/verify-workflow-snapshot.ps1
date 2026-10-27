#requires -Version 7.0

[CmdletBinding()]
param([string]$RepoRoot = (Join-Path $PSScriptRoot '..'))

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$RepoRoot = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($RepoRoot))
$manifestPath = 'wf/upstream-manifest.json'
$mutablePaths = @('wf/SESSION-LOG.md', 'wf/WAIT_USER.md', 'wf/workflows/common/gotchas.md', 'wf/workflows/common/user.md')

function Resolve-SnapshotPath([string]$RelativePath) {
    if ([string]::IsNullOrWhiteSpace($RelativePath) -or $RelativePath -match '\\|^[A-Za-z]:|^/|(^|/)\.\.?(/|$)') {
        throw "Invalid snapshot path: $RelativePath"
    }
    $fullPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot $RelativePath))
    if (-not $fullPath.StartsWith($RepoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::Ordinal)) {
        throw "Snapshot path escapes repository: $RelativePath"
    }
    # A junction or symlink would make a fresh checkout depend on another tree.
    $item = $fullPath
    while ($item -ne $RepoRoot) {
        if ((Test-Path -LiteralPath $item) -and ((Get-Item -LiteralPath $item -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Snapshot uses a symlink or junction: $RelativePath"
        }
        $item = [IO.Path]::GetDirectoryName($item)
    }
    return $fullPath
}

function Assert-Hash([string]$Path, [string]$Expected) {
    if ($Expected -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Expected) {
        throw "Snapshot SHA-256 mismatch: $Path"
    }
}

function Get-MarkdownAnchors([string]$Path) {
    $anchors = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $counts = @{}
    $fence = ''
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        if ($line -match '^\s{0,3}(`{3,}|~{3,})') {
            $marker = $Matches[1].Substring(0, 1)
            if ($fence -eq '') { $fence = $marker } elseif ($fence -eq $marker) { $fence = '' }
            continue
        }
        if ($fence -ne '') { continue }
        foreach ($match in [regex]::Matches($line, '(?i)\b(?:id|name)=["'']([^"'']+)["'']')) {
            [void]$anchors.Add($match.Groups[1].Value)
        }
        if ($line -match '^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$') {
            $heading = $Matches[1] -replace '\[([^\]]+)\]\([^)]*\)', '$1' -replace '<[^>]+>', ''
            $slug = ($heading.ToLowerInvariant() -replace '[^\p{L}\p{M}\p{N}_\-\s]', '') -replace '\s', '-'
            if ($counts.ContainsKey($slug)) { $counts[$slug]++; $anchor = "$slug-$($counts[$slug])" } else { $counts[$slug] = 0; $anchor = $slug }
            [void]$anchors.Add($anchor)
        }
    }
    return ,$anchors
}

$manifest = Get-Content -LiteralPath (Resolve-SnapshotPath $manifestPath) -Raw | ConvertFrom-Json -AsHashtable
if ($manifest.schema -cne 'workflow-snapshot/1' -or $manifest.upstream.remote -cne 'https://github.com/justty32/workflows.git' -or $manifest.upstream.commit -cnotmatch '^[a-f0-9]{40}$') {
    throw 'Invalid workflow manifest schema, upstream remote, or commit.'
}
$inventory = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($file in $manifest.files) {
    $path = [string]$file.path
    if (($path -cnotin @('AGENTS.md', 'CLAUDE.md') -and -not $path.StartsWith('wf/', [StringComparison]::Ordinal)) -or $path -cin @($manifestPath, 'wf/AGENTS.md') -or -not $inventory.Add($path)) {
        throw "Invalid or duplicate inventory path: $path"
    }
    $fullPath = Resolve-SnapshotPath $path
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing snapshot file: $path" }
    if ($file.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw "Invalid SHA-256: $path" }
    if ($file.ContainsKey('mutable') -and $file.mutable -isnot [bool]) { throw "Invalid mutable flag: $path" }
    if ($file.ContainsKey('mutable') -and $file.mutable -eq $true) {
        if ($path -cnotin $mutablePaths) { throw "Unexpected mutable file: $path" }
    } else { Assert-Hash $fullPath $file.sha256 }
}
foreach ($required in @('AGENTS.md', 'CLAUDE.md', 'wf/WORKFLOWS.md', 'wf/INDEX.md', 'wf/UPSTREAM.md', 'wf/SESSION-LOG.md', 'wf/WAIT_USER.md')) {
    if (-not $inventory.Contains($required)) { throw "Required snapshot file is not inventoried: $required" }
}
foreach ($item in Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'wf') -Recurse -Force) {
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Snapshot uses a symlink or junction: $($item.FullName)" }
    if (-not $item.PSIsContainer) {
        $relative = [IO.Path]::GetRelativePath($RepoRoot, $item.FullName).Replace('\', '/')
        if ($relative -cne $manifestPath -and -not $inventory.Contains($relative)) { throw "Unlisted snapshot file: $relative" }
    }
}
$license = $manifest.upstream.license
if (-not $inventory.Contains([string]$license.destination) -or [string]::IsNullOrWhiteSpace($license.source)) { throw 'License provenance is missing.' }
Assert-Hash (Resolve-SnapshotPath $license.destination) $license.sha256
if (@($manifest.sources).Count -eq 0) { throw 'Source provenance is empty.' }
foreach ($source in $manifest.sources) {
    if ($source.blob -cnotmatch '^[a-f0-9]{40}$' -or $source.source -cnotmatch '^(template/|flavors/(dev|knowledge)/|LICENSE)' -or -not $inventory.Contains([string]$source.destination) -or [string]::IsNullOrWhiteSpace($source.transformation)) {
        throw "Invalid source provenance: $($source.source)"
    }
}

$linkCount = 0
$anchorCache = @{}
foreach ($path in $inventory) {
    if (-not $path.EndsWith('.md', [StringComparison]::Ordinal)) { continue }
    $fullPath = Resolve-SnapshotPath $path
    $text = [IO.File]::ReadAllText($fullPath)
    if ($text -match '\{\{|〔(?:模板說明|佔位|導入判斷)〕') { throw "Unfilled template marker: $path" }
    if ($path -cne 'wf/UPSTREAM.md' -and $text -match '(?i)(?<![a-z0-9_-])(?:inbox|tick|routines|schedule|digest|plan-a-thing|decide|learn|organize)(?![a-z0-9_-])') {
        throw "Excluded workflow reference: $path ($($Matches[0]))"
    }
    # Inline and reference-style Markdown destinations; external URLs are not fetched.
    $links = [regex]::Matches($text, '\[[^\]\r\n]*\]\(\s*<?([^\s)>]+)>?(?:\s+["''][^\r\n]*?["''])?\s*\)|(?m)^\s{0,3}\[[^\]\r\n]+\]:\s*<?([^\s>]+)>?')
    foreach ($link in $links) {
        $target = $link.Groups[1].Value
        if ($target -eq '') { $target = $link.Groups[2].Value }
        if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:|^//') { continue }
        $parts = $target.Split('#', 2)
        $relative = [Uri]::UnescapeDataString($parts[0].Split('?', 2)[0])
        if ($relative -match '^/|\\') { throw "Nonportable Markdown link: $path -> $target" }
        $destination = if ($relative -eq '') { $fullPath } else { [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetDirectoryName($fullPath)) $relative)) }
        if (($destination -cne $RepoRoot -and -not $destination.StartsWith($RepoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::Ordinal)) -or -not (Test-Path -LiteralPath $destination)) {
            throw "Broken Markdown link: $path -> $target"
        }
        if ($parts.Count -gt 1 -and $parts[1] -ne '' -and $destination.EndsWith('.md', [StringComparison]::OrdinalIgnoreCase)) {
            if (-not $anchorCache.ContainsKey($destination)) { $anchorCache[$destination] = Get-MarkdownAnchors $destination }
            if (-not $anchorCache[$destination].Contains([Uri]::UnescapeDataString($parts[1]))) { throw "Broken Markdown anchor: $path -> $target" }
        }
        $linkCount++
    }
}
Write-Host "WORKFLOW SNAPSHOT PASS — $($inventory.Count) files, $linkCount local links, 0 broken links or template markers"
