[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Apply)

# Preview by default. Run with -Apply after reviewing the printed manifest.
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$videoRoot = (Resolve-Path -LiteralPath (Join-Path $workspace 'qa/submission-video')).Path
$latest = Join-Path $videoRoot 'chaos-factory-demo-v15.mp4'
if (!(Test-Path -LiteralPath $latest -PathType Leaf)) {
    throw 'The finished v15 video must exist before cleaning its older exports.'
}
$edit = Get-Content -LiteralPath (Join-Path $videoRoot 'edit.json') -Raw | ConvertFrom-Json
if ($edit.edition -ne 15 -or $edit.duration -le 0 -or $edit.duration -ge 180) {
    throw 'Wait for the v15 export and its validated edit manifest to finish.'
}
$protected = @(
    'chaos-factory-demo-v15.mp4', 'chaos-factory-demo.mp4', 'edit.json',
    'full-cup-sfx/full-cup.webm', 'full-cup-sfx/capture.json',
    'join-crowd/crowd.webm', 'join-crowd/capture.json',
    'live-join/live-join.webm', 'live-join/capture.json',
    'host-setup/dashboard.webm', 'host-setup/capture.json',
    'host-setup-v15/dashboard.webm', 'host-setup-v15/capture.json',
    'optional-games/pong-wars/game.webm', 'optional-games/pong-wars/capture.json',
    'optional-games/light-cycles/game.webm', 'optional-games/light-cycles/capture.json',
    'optional-games/ring-escape/game.webm', 'optional-games/ring-escape/capture.json'
) | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $videoRoot $_)) }
foreach ($file in $protected) {
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing protected source: $file" }
}

$candidates = [Collections.Generic.List[string]]::new()
foreach ($version in 1..14) {
    $candidates.Add((Join-Path $videoRoot "chaos-factory-demo-v$version.mp4"))
    $candidates.Add((Join-Path $videoRoot "chaos-factory-offline-preview-v$version.mp4"))
    $candidates.Add((Join-Path $videoRoot "contact-sheet-v$version.png"))
    $candidates.Add((Join-Path $videoRoot "edit-v$version.json"))
    $candidates.Add((Join-Path $videoRoot "v$version-review"))
}
# Regenerable edit frames/segments, superseded music-mixed Cup, redundant raw captures.
foreach ($relative in @('edit', 'full-cup', 'host-setup-v8', 'selection-v13', 'selection-v14', 'selection-v15',
    'full-cup-sfx/full-cup-raw.webm', 'live-join/live-join-raw.webm',
    'join-crowd/crowd-raw.webm', 'host-setup/dashboard-raw.webm', 'host-setup-v15/dashboard-raw.webm',
    'optional-games/pong-wars/raw.webm', 'optional-games/light-cycles/raw.webm',
    'optional-games/ring-escape/raw.webm')) {
    $candidates.Add((Join-Path $videoRoot $relative))
}
foreach ($folder in @('host-setup', 'join-crowd', 'live-join')) {
    Get-ChildItem -LiteralPath (Join-Path $videoRoot $folder) -File |
        Where-Object { $_.Extension -in '.webm', '.mp4' -and $_.FullName -notin $protected } |
        ForEach-Object { $candidates.Add($_.FullName) }
}

$manifest = foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (!(Test-Path -LiteralPath $candidate)) { continue }
    $absolute = (Resolve-Path -LiteralPath $candidate).Path
    if (!$absolute.StartsWith($videoRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) { throw "Outside video workspace: $absolute" }
    foreach ($source in $protected) {
        if ($source -eq $absolute -or $source.StartsWith($absolute + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) { throw "Protected source: $absolute" }
    }
    $item = Get-Item -LiteralPath $absolute
    $items = if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $absolute -File -Recurse) } else { @($item) }
    $links = @(Get-ChildItem -LiteralPath $absolute -Force -Recurse |
        Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $links.Count) {
        throw "Refusing recursive cleanup through links: $absolute"
    }
    [pscustomobject]@{ Path = $absolute; Bytes = ($items | Measure-Object Length -Sum).Sum }
}
$manifest | Format-Table @{Name='MiB';Expression={[math]::Round($_.Bytes / 1MB, 1)}}, Path -AutoSize
$bytes = ($manifest | Measure-Object Bytes -Sum).Sum
Write-Host ('Total: {0:N2} GiB; originals, v15 final and v15 review are retained.' -f ($bytes / 1GB))
if (!$Apply) { Write-Host 'Preview only. Add -Apply to remove exactly these paths.'; return }
foreach ($entry in $manifest) {
    if ($PSCmdlet.ShouldProcess($entry.Path, 'Remove obsolete video or regenerable edit files')) {
        Remove-Item -LiteralPath $entry.Path -Recurse -Force
    }
}
