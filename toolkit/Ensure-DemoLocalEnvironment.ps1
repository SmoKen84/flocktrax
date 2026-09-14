param(
  [Parameter(Mandatory = $true)]
  [string]$EnvFile,

  [Parameter(Mandatory = $true)]
  [string]$DemoProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$ProductionProjectRef
)

$ErrorActionPreference = "Stop"

function Get-EnvValues {
  param([string[]]$Lines)

  $values = @{}
  foreach ($line in $Lines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $value = $matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
          ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $values[$matches[1]] = $value
    }
  }
  return $values
}

function Set-EnvValue {
  param(
    [string[]]$Lines,
    [string]$Name,
    [string]$Value
  )

  if ($Value.Contains("`r") -or $Value.Contains("`n") -or $Value.Contains('"')) {
    throw "The retrieved value for $Name has an unsupported format."
  }

  $replacement = "$Name=`"$Value`""
  $found = $false
  $updated = foreach ($line in $Lines) {
    if ($line -match "^\s*$([regex]::Escape($Name))=") {
      $found = $true
      $replacement
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated += $replacement
  }
  return [string[]]$updated
}

function Test-UsableAdminKey {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }
  if ($Value -notmatch '^[\x21-\x7E]+$') {
    return $false
  }
  return $Value.StartsWith('sb_secret_') -or $Value.StartsWith('eyJ')
}

$resolvedEnvFile = [IO.Path]::GetFullPath($EnvFile)
if (-not (Test-Path -LiteralPath $resolvedEnvFile)) {
  throw "Demo environment file does not exist: $resolvedEnvFile"
}

$lines = [IO.File]::ReadAllLines($resolvedEnvFile)
$values = Get-EnvValues -Lines $lines
$supabaseUrl = [string]$values['NEXT_PUBLIC_SUPABASE_URL']

if ([string]::IsNullOrWhiteSpace($supabaseUrl) -or -not $supabaseUrl.Contains($DemoProjectRef)) {
  throw "NEXT_PUBLIC_SUPABASE_URL does not identify the expected demo project."
}
if ($supabaseUrl.Contains($ProductionProjectRef)) {
  throw "Production Supabase was detected in the demo environment."
}

$adminKey = [string]$values['SUPABASE_SECRET_KEY']
$legacyAdminKey = [string]$values['SUPABASE_SERVICE_ROLE_KEY']
if (-not (Test-UsableAdminKey -Value $adminKey) -and
    -not (Test-UsableAdminKey -Value $legacyAdminKey)) {
  Write-Host "The hosted sensitive Admin key was not readable through Vercel; retrieving it directly from the demo Supabase project..."
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $json = & supabase projects api-keys --project-ref $DemoProjectRef --output json 2>$null
  $supabaseExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($supabaseExitCode -ne 0 -or [string]::IsNullOrWhiteSpace(($json -join ""))) {
    throw "Supabase CLI could not retrieve the demo API keys. Sign in with 'supabase login' and retry."
  }

  $apiKeys = $json | ConvertFrom-Json
  $selected = $apiKeys |
    Where-Object {
      $_.name -eq 'service_role' -and
      ([string]$_.api_key) -match '^eyJ[\x21-\x7E]+$'
    } |
    Select-Object -First 1

  $legacyAdminKey = [string]$selected.api_key
  if (-not (Test-UsableAdminKey -Value $legacyAdminKey)) {
    throw "No usable localhost Admin key was returned for the demo Supabase project."
  }

  $lines = Set-EnvValue -Lines $lines -Name 'SUPABASE_SECRET_KEY' -Value ''
  $lines = Set-EnvValue -Lines $lines -Name 'SUPABASE_SERVICE_ROLE_KEY' -Value $legacyAdminKey
  [IO.File]::WriteAllLines($resolvedEnvFile, $lines, [Text.UTF8Encoding]::new($false))
  Write-Host "Private demo Admin access was added to the ignored local environment file."
} else {
  Write-Host "Private demo Admin access is already configured locally."
}

Write-Host "Demo environment verification passed."
