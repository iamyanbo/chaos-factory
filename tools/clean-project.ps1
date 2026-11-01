[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Apply)

# Clear generated editing/test caches only. Never touch dependencies, credentials or recordings.
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$videoRoot = Join-Path $workspace 'qa/submission-video'
$final = Join-Path $videoRoot 'chaos-factory-demo.mp4'
$finalHash = if (Test-Path -LiteralPath $final) { (Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash }
$sourceRecordings = @(Get-ChildItem -LiteralPath (Join-Path $workspace 'qa') -File -Recurse -Filter '*.webm' |
    Select-Object -ExpandProperty FullName)
$tracked = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
git -C $workspace ls-files | ForEach-Object { [void]$tracked.Add([IO.Path]::GetFullPath((Join-Path $workspace $_))) }
$candidates = [Collections.Generic.List[object]]::new()

function CheckedPath([string]$path) {
    $absolute = [IO.Path]::GetFullPath($path)
    if (!$absolute.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) { throw "Outside project workspace: $absolute" }
    return $absolute
}

function AddCache([string]$path) {
    $absolute = CheckedPath $path
    if (!(Test-Path -LiteralPath $absolute)) { return }
    $item = Get-Item -LiteralPath $absolute -Force
    if (!$item.PSIsContainer -and $item.Extension -eq '.log') {
        try {
            $handle = [IO.File]::Open($absolute, [IO.FileMode]::Open,
                [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
            $handle.Dispose()
        } catch [IO.IOException] {
            Write-Host "Keeping active log: $($item.Name)"
            return
        }
    }
    $children = @(Get-ChildItem -LiteralPath $absolute -Recurse -Force)
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        @($children | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {
        throw "Refusing cleanup through filesystem links: $absolute"
    }
    $files = @($children | Where-Object { !$_.PSIsContainer })
    if (!$item.PSIsContainer) { $files = @($item) }
    foreach ($file in $files) {
        $target = CheckedPath $file.FullName
        if ($tracked.Contains($target) -or $file.Extension -in '.webm', '.mp4', '.heapsnapshot' -or
            $file.Name -like '.env*') { throw "Protected project file in cache: $target" }
    }
    $candidates.Add([pscustomobject]@{
        Path = $absolute; Directory = $item.PSIsContainer;
        Bytes = ($files | Measure-Object Length -Sum).Sum; Files = $files.Count
    })
}

AddCache (Join-Path $videoRoot 'edit/overlays')
AddCache (Join-Path $videoRoot 'codex-preview/frames')
AddCache (Join-Path $videoRoot 'codex-grid/frames')
$cards = Join-Path $videoRoot 'edit/cards'
if (Test-Path -LiteralPath $cards) {
    Get-ChildItem -LiteralPath $cards -Directory | Where-Object { $_.Name -like '*-frames' } |
        ForEach-Object { AddCache $_.FullName }
}
$editPath = Join-Path $videoRoot 'edit.json'
if (Test-Path -LiteralPath $editPath) {
    $edit = Get-Content -LiteralPath $editPath -Raw | ConvertFrom-Json
    Get-ChildItem -LiteralPath $videoRoot -Directory | ForEach-Object {
        if ($_.Name -match '^v(\d+)-review$' -and [int]$Matches[1] -lt $edit.edition) {
            Get-ChildItem -LiteralPath $_.FullName -File -Filter '*.png' |
                Where-Object { $_.Name -match '^(film|gameplay|queue-motion|held-queue)-\d+\.png$' } |
                ForEach-Object { AddCache $_.FullName }
        }
    }
}
$oldLogCutoff = (Get-Date).AddHours(-1)
Get-ChildItem -LiteralPath (Join-Path $workspace 'qa') -File -Filter '*.log' |
    Where-Object { $_.LastWriteTime -lt $oldLogCutoff -and $_.Name -notlike 'cleanup-*' } |
    ForEach-Object { AddCache $_.FullName }
foreach ($folder in @('test-results', 'test-results-offline', 'playwright-report')) {
    AddCache (Join-Path $workspace $folder)
}

$bytes = ($candidates | Measure-Object Bytes -Sum).Sum
$count = ($candidates | Measure-Object Files -Sum).Sum
$report = [pscustomobject]@{ Workspace = $workspace; Applied = $false;
    Bytes = $bytes; Files = $count; PreservedWebMs = $sourceRecordings.Count;
    FinalSha256 = $finalHash; Targets = @($candidates.ToArray()) }
$reportPath = Join-Path $workspace 'qa/project-cleanup.json'
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host ('Generated cache cleanup: {0} files, {1:N2} GiB. {2} source WebMs preserved.' -f
    $count, ($bytes / 1GB), $sourceRecordings.Count)
if (!$Apply) { Write-Host 'Preview only. Use -Apply to remove the listed caches.'; return }
foreach ($entry in $candidates) {
    $absolute = CheckedPath $entry.Path
    if ($PSCmdlet.ShouldProcess($absolute, 'Remove generated cache')) {
        if ($entry.Directory) { Remove-Item -LiteralPath $absolute -Recurse -Force }
        else { Remove-Item -LiteralPath $absolute -Force }
    }
}
foreach ($source in $sourceRecordings) {
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Recording missing after cleanup: $source" }
}
if ($finalHash -and (Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash -ne $finalHash) {
    throw 'Final video changed during cleanup'
}
$report.Applied = $true
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host 'Generated caches removed; final video and source recordings verified intact.'
