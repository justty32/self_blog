Set-StrictMode -Version Latest

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
                if ($entry.FullName.EndsWith('/')) {
                    Ensure-SafeDirectory -Path $outputPath -Root $destinationRoot
                    continue
                }
                Ensure-SafeDirectory -Path ([System.IO.Path]::GetDirectoryName($outputPath)) -Root $destinationRoot
                $entryStream = $entry.Open()
                try {
                    $out = [System.IO.File]::Create($outputPath)
                    try { $entryStream.CopyTo($out) } finally { $out.Dispose() }
                } finally { $entryStream.Dispose() }
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
                    if ($entry.EntryType.ToString() -eq 'Directory') {
                        Ensure-SafeDirectory -Path $outputPath -Root $destinationRoot
                        continue
                    }
                    if ($entry.EntryType.ToString() -notin @('RegularFile', 'V7RegularFile', 'ContiguousFile')) {
                        throw "Refusing non-regular tar entry '$($entry.Name)' ($($entry.EntryType))."
                    }
                    Ensure-SafeDirectory -Path ([System.IO.Path]::GetDirectoryName($outputPath)) -Root $destinationRoot
                    $output = [System.IO.File]::Create($outputPath)
                    try { $entry.DataStream.CopyTo($output) } finally { $output.Dispose() }
                }
            } finally { $reader.Dispose() }
        } finally { $gzip.Dispose() }
    } finally { $input.Dispose() }
}
