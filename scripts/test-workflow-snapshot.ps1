#requires -Version 7.0

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('self-blog-workflow-test-' + [guid]::NewGuid().ToString('N'))
$verifier = Join-Path $PSScriptRoot 'verify-workflow-snapshot.ps1'
$utf8 = [Text.UTF8Encoding]::new($false)
$fixture = [ordered]@{
    'AGENTS.md' = "# Fixture`n[Workflows](wf/WORKFLOWS.md#流程)`n"
    'CLAUDE.md' = "[AGENTS.md](AGENTS.md)`n"
    'wf/WORKFLOWS.md' = "# 流程`n[入口](../AGENTS.md)`n"
    'wf/INDEX.md' = "# Index`n"
    'wf/UPSTREAM.md' = "# Upstream`n"
    'wf/SESSION-LOG.md' = "# Open work`n"
    'wf/WAIT_USER.md' = "# Waiting`n"
    'wf/LICENSE.txt' = "Fixture license`n"
}

function Write-FixtureFile([string]$Path, [string]$Text) {
    $destination = Join-Path $testRoot $Path
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
    [IO.File]::WriteAllText($destination, $Text, $utf8)
}
function Save-FixtureManifest {
    $files = foreach ($path in $fixture.Keys) {
        @{path = $path; sha256 = (Get-FileHash -LiteralPath (Join-Path $testRoot $path) -Algorithm SHA256).Hash.ToLowerInvariant(); mutable = $path -in @('wf/SESSION-LOG.md', 'wf/WAIT_USER.md')}
    }
    $manifest = @{
        schema = 'workflow-snapshot/1'
        upstream = @{
            remote = 'https://github.com/justty32/workflows.git'
            commit = '1' * 40
            license = @{source = 'LICENSE'; destination = 'wf/LICENSE.txt'; sha256 = (Get-FileHash (Join-Path $testRoot 'wf/LICENSE.txt') -Algorithm SHA256).Hash.ToLowerInvariant()}
        }
        sources = @(@{source = 'template/AGENTS.md'; blob = '2' * 40; destination = 'AGENTS.md'; transformation = 'Fixture adaptation'})
        files = @($files)
    }
    Write-FixtureFile 'wf/upstream-manifest.json' ($manifest | ConvertTo-Json -Depth 8)
}
function Reset-Fixture {
    foreach ($path in $fixture.Keys) { Write-FixtureFile $path $fixture[$path] }
    Save-FixtureManifest
}
function Assert-Rejected([string]$Name, [string]$Expected) {
    $failure = $null
    try { & $verifier -RepoRoot $testRoot } catch { $failure = $_.Exception.Message }
    if ($null -eq $failure -or $failure -notmatch $Expected) { throw "$Name did not fail as expected: $failure" }
    Write-Host "PASS: $Name"
}

try {
    Reset-Fixture
    & $verifier -RepoRoot $testRoot
    Write-Host 'PASS: valid snapshot and Chinese heading anchor.'
    & $verifier -RepoRoot ($testRoot + [IO.Path]::DirectorySeparatorChar)
    Write-Host 'PASS: repository path accepts a trailing directory separator.'

    Write-FixtureFile 'AGENTS.md' "# Tampered`n"
    Assert-Rejected 'Modified snapshot bytes' 'SHA-256 mismatch'
    Reset-Fixture

    Write-FixtureFile 'wf/unlisted.md' "# Unexpected`n"
    Assert-Rejected 'Unexpected snapshot file' 'Unlisted snapshot file'
    Remove-Item -LiteralPath (Join-Path $testRoot 'wf/unlisted.md')

    Write-FixtureFile 'AGENTS.md' "[Missing](wf/missing.md)`n"
    Save-FixtureManifest
    Assert-Rejected 'Broken link after deliberate hash refresh' 'Broken Markdown link'
    Reset-Fixture

    Write-FixtureFile 'AGENTS.md' "[Missing](wf/WORKFLOWS.md#absent)`n"
    Save-FixtureManifest
    Assert-Rejected 'Broken heading anchor' 'Broken Markdown anchor'
    Reset-Fixture

    Write-FixtureFile 'wf/WORKFLOWS.md' "# 流程`n請走 digest 工作流。`n"
    Save-FixtureManifest
    Assert-Rejected 'Excluded workflow in plain text' 'Excluded workflow reference'
    Reset-Fixture

    Write-FixtureFile 'AGENTS.md' "# {{PROJECT}}`n"
    Save-FixtureManifest
    Assert-Rejected 'Unfilled template marker' 'Unfilled template marker'
    Reset-Fixture

    Write-FixtureFile 'wf/SESSION-LOG.md' "# Open work`n- [ ] Fresh session work`n"
    & $verifier -RepoRoot $testRoot
    Write-Host 'PASS: live state changes do not require a manifest hash refresh.'

    Write-FixtureFile 'wf/SESSION-LOG.md' "[Missing](missing.md)`n"
    Assert-Rejected 'Mutable files still undergo link validation' 'Broken Markdown link'
    Reset-Fixture

    $manifestPath = Join-Path $testRoot 'wf/upstream-manifest.json'
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json -AsHashtable
    $manifest.files[0].path = '../outside.md'
    Write-FixtureFile 'wf/upstream-manifest.json' ($manifest | ConvertTo-Json -Depth 8)
    Assert-Rejected 'Manifest path traversal' 'Invalid.*path'
    Write-Host 'WORKFLOW SNAPSHOT TESTS PASS'
} finally {
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
