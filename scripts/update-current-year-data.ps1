param(
  [string]$SourceRoot = "C:\Users\HP\Dropbox\Revenue PU Laibilities\PPT\DATA FILES",
  [string]$Year = "2026-2027"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceYearDir = Join-Path $SourceRoot $Year
$targetYearDir = Join-Path $repoRoot "data\source-files\$Year"

$files = @(
  @{ Source = "PU Wise $Year Budget.xls"; Target = "pu-budget.xls" },
  @{ Source = "PU Wise Month Wise $Year Actual.xls"; Target = "pu-month-actual.xls" },
  @{ Source = "SMH-DEMAND Wise PU wise Dept wise Month Wise $Year Budget.xls"; Target = "pu-dept-demand-smh-budget.xls" },
  @{ Source = "SMH-DEMAND Wise PU wise Dept wise Month Wise $Year Actual.xls"; Target = "pu-dept-demand-smh-actual.xls" },
  @{ Source = "SMH-DEMAND Wise $Year Budget.xls"; Target = "demand-smh-budget.xls" },
  @{ Source = "SMH-DEMAND WISE $Year ACTUAL.xls"; Target = "demand-smh-actual.xls" }
)

if (-not (Test-Path -LiteralPath $sourceYearDir)) {
  throw "Source folder not found: $sourceYearDir"
}

New-Item -ItemType Directory -Force -Path $targetYearDir | Out-Null
foreach ($file in $files) {
  $sourcePath = Join-Path $sourceYearDir $file.Source
  $targetPath = Join-Path $targetYearDir $file.Target
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Required source file not found: $sourcePath"
  }
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  Write-Host "Updated $($file.Target)"
}

Write-Host "Current year source files refreshed for $Year. Commit and push data/source-files/$Year to publish the update."
