[CmdletBinding()]
param(
  [ValidateSet("Cutover", "Revoked")]
  [string]$Stage = "Cutover",
  [string]$WebAdminDirectory = (Join-Path $PSScriptRoot "..\web-admin"),
  [switch]$PromptForSecret,
  [switch]$RequireAuthenticatedProbe
)

$ErrorActionPreference = "Stop"
$tempEnvironmentPath = Join-Path (
  [IO.Path]::GetTempPath()
) ("flocktrax-release1-{0}.env" -f [guid]::NewGuid().ToString("N"))

function Read-DotEnv {
  param([string]$Path)

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      continue
    }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
  }
  $values
}

try {
  Push-Location $WebAdminDirectory
  try {
    & vercel env pull $tempEnvironmentPath --environment=production --yes
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel production environment pull failed."
    }
  } finally {
    Pop-Location
  }

  $productionEnvironment = Read-DotEnv $tempEnvironmentPath
  $newSecretKey = $null
  if ($PromptForSecret) {
    $secureSecret = Read-Host "Paste the FlockTrax Supabase secret key" -AsSecureString
    $newSecretKey = ConvertFrom-SecureString $secureSecret -AsPlainText
  } else {
    $newSecretKey = $productionEnvironment["SUPABASE_SECRET_KEY"]
  }

  $localEnvironment = Read-DotEnv (Join-Path $WebAdminDirectory ".env")

  $legacyServiceRoleKey = $localEnvironment["SUPABASE_SERVICE_ROLE_KEY"]
  $publicKey = $productionEnvironment["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
  if ([string]::IsNullOrWhiteSpace($publicKey)) {
    $publicKey = $localEnvironment["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  }
  $supabaseUrl = $localEnvironment["NEXT_PUBLIC_SUPABASE_URL"]

  if ([string]::IsNullOrWhiteSpace($newSecretKey) -or -not $newSecretKey.StartsWith("sb_secret_")) {
    throw "The Vercel production secret was not retrievable for verification."
  }

  $env:FLOCKTRAX_NEW_SECRET_KEY = $newSecretKey
  $env:FLOCKTRAX_LEGACY_SERVICE_ROLE_KEY = $legacyServiceRoleKey
  $env:FLOCKTRAX_PUBLIC_KEY = $publicKey
  $env:FLOCKTRAX_SUPABASE_URL = $supabaseUrl

  $arguments = @(
    "-NoProfile",
    "-File", (Join-Path $PSScriptRoot "Test-FlockTraxRelease1.ps1"),
    "-Stage", $Stage,
    "-SkipLocalChecks",
    "-RunProductionProbes"
  )
  if ($RequireAuthenticatedProbe) {
    $arguments += "-RequireAuthenticatedProbe"
  }

  & pwsh @arguments
  exit $LASTEXITCODE
} finally {
  Remove-Item -LiteralPath $tempEnvironmentPath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:FLOCKTRAX_NEW_SECRET_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FLOCKTRAX_LEGACY_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FLOCKTRAX_PUBLIC_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FLOCKTRAX_SUPABASE_URL -ErrorAction SilentlyContinue
}
