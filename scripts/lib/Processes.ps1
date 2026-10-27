Set-StrictMode -Version Latest

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
