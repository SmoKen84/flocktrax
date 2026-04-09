<#
FlockTrax_Supabase_Snapshot.ps1
- Stops Supabase (no backup)
- Archives key Docker volumes (DB + Storage + Edge Runtime by default)
- Writes a manifest with file hashes + volume list
- Restarts Supabase

Run from your Supabase project root (e.g., C:\dev\FlockTrax)
#>

$ErrorActionPreference = "Stop"

# --- Settings (edit if you want) ---
$ProjectRoot = (Get-Location).Path
$Prefix      = "FlockTrax"

# Choose which volumes to snapshot (regex list). Add/remove as you like.
$VolumeNamePatterns = @(
  '^supabase_db_',
  '^supabase_storage_',
  '^supabase_edge_runtime_'
)

# --- Helpers ---
function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

function Run($label, $scriptblock) {
  Write-Host "`n==> $label" -ForegroundColor Cyan
  & $scriptblock
}

Require-Cmd docker
Require-Cmd supabase

$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$OutDir = Join-Path $ProjectRoot "snapshots"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$manifestPath = Join-Path $OutDir "${Prefix}_snapshot_${stamp}_MANIFEST.txt"

Run "Capturing volume list" {
  $allVolumes = docker volume ls --format "{{.Name}}" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  $targets = foreach ($v in $allVolumes) {
    foreach ($rx in $VolumeNamePatterns) {
      if ($v -match $rx) { $v; break }
    }
  }
  $targets = $targets | Sort-Object -Unique

  if (-not $targets -or $targets.Count -eq 0) {
    throw "No matching volumes found. Existing volumes:`n$($allVolumes -join "`n")"
  }

  "Snapshot Timestamp: $stamp"                         | Out-File -FilePath $manifestPath -Encoding utf8
  "Project Root:      $ProjectRoot"                    | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "Output Folder:     $OutDir"                         | Out-File -FilePath $manifestPath -Append -Encoding utf8
  ""                                                   | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "Volumes Selected:"                                  | Out-File -FilePath $manifestPath -Append -Encoding utf8
  ($targets | ForEach-Object { "  - $_" })             | Out-File -FilePath $manifestPath -Append -Encoding utf8
  ""                                                   | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "Archives:"                                          | Out-File -FilePath $manifestPath -Append -Encoding utf8

  Set-Variable -Name Targets -Value $targets -Scope Script
}

Run "Stopping Supabase (no backup)" {
  supabase stop --no-backup | Out-Host
}

# Archive each volume into its own tgz
foreach ($vol in $Targets) {
  $safeVol = $vol -replace '[^A-Za-z0-9_\-\.]+','_'
  $tgzName = "${Prefix}_${safeVol}_${stamp}.tgz"
  $tgzPath = Join-Path $OutDir $tgzName

  Run "Archiving volume: $vol -> $tgzName" {
    # Use Alpine to tar the contents of the named Docker volume.
    # We mount the output folder as /backup and write the tgz there.
    docker run --rm `
      -v "${vol}:/volume" `
      -v "${OutDir}:/backup" `
      alpine sh -lc "cd /volume && tar -czf /backup/$tgzName ."
  }

  # Hash + record in manifest
  $hash = (Get-FileHash -Algorithm SHA256 -Path $tgzPath).Hash
  $size = (Get-Item $tgzPath).Length

  ("  - {0}  size={1}  sha256={2}" -f $tgzName, $size, $hash) |
    Out-File -FilePath $manifestPath -Append -Encoding utf8
}

Run "Writing quick restore notes into manifest" {
  "" | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "Restore Notes (high level):" | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "  1) supabase stop --no-backup" | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "  2) docker volume rm <volume>" | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "  3) docker volume create <volume>" | Out-File -FilePath $manifestPath -Append -Encoding utf8
  "  4) docker run --rm -v <volume>:/volume -v <folder>:/backup alpine sh -lc `"cd /volume && tar -xzf /backup/<tgz> -C /volume`"" |
    Out-File -FilePath $manifestPath -Append -Encoding utf8
  "  5) supabase start" | Out-File -FilePath $manifestPath -Append -Encoding utf8
}

Run "Restarting Supabase" {
  supabase start | Out-Host
}

Run "Done" {
  Write-Host "Snapshot folder: $OutDir" -ForegroundColor Green
  Write-Host "Manifest:        $manifestPath" -ForegroundColor Green
  Write-Host "`nLatest files:" -ForegroundColor Green
  Get-ChildItem $OutDir -Filter "${Prefix}_*_${stamp}.tgz" | Sort-Object Name | Format-Table Name, Length, LastWriteTime
  Get-Item $manifestPath | Format-Table Name, Length, LastWriteTime
}
