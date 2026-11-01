[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Apply)

# The owner authorized removing other MP4s. Keep the verified final and all source WebMs.
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$videoRoot = (Resolve-Path -LiteralPath (Join-Path $workspace 'qa/submission-video')).Path
$expectedRoot = [IO.Path]::GetFullPath((Join-Path $workspace 'qa/submission-video'))
if ($videoRoot -ne $expectedRoot) { throw 'Unexpected video workspace' }
$final = [IO.Path]::GetFullPath((Join-Path $videoRoot 'chaos-factory-demo.mp4'))
$edit = Get-Content -LiteralPath (Join-Path $videoRoot 'edit.json') -Raw | ConvertFrom-Json
$review = Get-Content -LiteralPath (Join-Path $videoRoot 'v18-review/technical.json') -Raw | ConvertFrom-Json
if ($edit.edition -ne 18 -or [IO.Path]::GetFullPath($edit.output) -ne $final -or
    $edit.duration -le 0 -or $edit.duration -ge 180 -or !(Test-Path -LiteralPath $final -PathType Leaf)) {
    throw 'The final Blade-repaired video must be complete before cleanup'
}
if ($review.edition -ne 18 -or $review.decodeErrors -ne 0 -or !$review.strictVideoDts -or
    [math]::Abs($review.duration - $edit.duration) -gt 0.034) {
    throw 'Final media review must pass before cleanup'
}
if (@($edit.bladeRepair.cadence).Count -ne 2 -or
    @($edit.bladeRepair.cadence | Where-Object { $_.framesPerSecond -lt 45 -or $_.gapsOver100Ms -gt 0 }).Count) {
    throw 'Both replacement Blade excerpts must pass recorded-frame cadence checks'
}
$links = @(Get-ChildItem -LiteralPath $videoRoot -Force -Recurse |
    Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
if ($links.Count) { throw 'Refusing cleanup through filesystem links' }
$sourcesBefore = @(Get-ChildItem -LiteralPath $videoRoot -File -Recurse -Filter '*.webm' |
    Select-Object -ExpandProperty FullName)
$candidates = @(Get-ChildItem -LiteralPath $videoRoot -File -Recurse -Filter '*.mp4' |
    Where-Object { $_.FullName -ne $final })
$manifest = foreach ($item in $candidates) {
    $absolute = (Resolve-Path -LiteralPath $item.FullName).Path
    if (!$absolute.StartsWith($videoRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase) -or $absolute -eq $final -or
        [IO.Path]::GetExtension($absolute) -ne '.mp4') { throw "Unsafe cleanup target: $absolute" }
    [pscustomobject]@{ Path = $absolute; Bytes = $item.Length }
}
$finalHash = (Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash
$bytes = ($manifest | Measure-Object Bytes -Sum).Sum
$report = [pscustomobject]@{ Final = $final; FinalSha256 = $finalHash;
    Files = @($manifest); Count = $candidates.Count; Bytes = $bytes; Applied = $false }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $videoRoot 'mp4-cleanup.json') -Encoding UTF8
Write-Host ('{0} older/intermediate MP4s, {1:N2} GiB. Final and {2} source WebMs retained.' -f
    $candidates.Count, ($bytes / 1GB), $sourcesBefore.Count)
if (!$Apply) { Write-Host 'Preview only. Run with -Apply to remove these MP4 files.'; return }
foreach ($entry in $manifest) {
    if ($PSCmdlet.ShouldProcess($entry.Path, 'Remove superseded MP4')) {
        Remove-Item -LiteralPath $entry.Path -Force
    }
}
if ((Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash -ne $finalHash) { throw 'Final file changed' }
foreach ($source in $sourcesBefore) {
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Source WebM missing: $source" }
}
$report.Applied = $true
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $videoRoot 'mp4-cleanup.json') -Encoding UTF8
Write-Host 'MP4 cleanup complete. The final movie and all source WebMs are intact.'
