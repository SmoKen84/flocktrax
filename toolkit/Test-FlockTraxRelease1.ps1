[CmdletBinding()]
param(
  [ValidateSet("Preflight", "Cutover", "Revoked")]
  [string]$Stage = "Preflight",

  [string]$SupabaseUrl = $env:FLOCKTRAX_SUPABASE_URL,
  [string]$PublicKey = $env:FLOCKTRAX_PUBLIC_KEY,
  [string]$NewSecretKey = $env:FLOCKTRAX_NEW_SECRET_KEY,
  [string]$LegacyServiceRoleKey = $env:FLOCKTRAX_LEGACY_SERVICE_ROLE_KEY,
  [string]$TestAccessToken = $env:FLOCKTRAX_TEST_ACCESS_TOKEN,
  [string]$WebUrl = "https://flocktrax.com",

  [switch]$SkipLocalChecks,
  [switch]$RunProductionProbes,
  [switch]$RequireAuthenticatedProbe
)

$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$script:Skipped = 0
$script:Results = [System.Collections.Generic.List[object]]::new()
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Add-Result {
  param(
    [string]$Name,
    [ValidateSet("PASS", "FAIL", "SKIP")]
    [string]$Status,
    [string]$Detail
  )

  switch ($Status) {
    "PASS" { $script:Passed++ }
    "FAIL" { $script:Failed++ }
    "SKIP" { $script:Skipped++ }
  }

  $script:Results.Add([pscustomobject]@{
      Check = $Name
      Status = $Status
      Detail = $Detail
    })
}

function Invoke-Check {
  param(
    [string]$Name,
    [scriptblock]$Check
  )

  try {
    $detail = & $Check
    Add-Result -Name $Name -Status "PASS" -Detail ([string]$detail)
  } catch {
    Add-Result -Name $Name -Status "FAIL" -Detail $_.Exception.Message
  }
}

function Invoke-LocalCommand {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Executable,
    [string[]]$Arguments
  )

  Invoke-Check -Name $Name -Check {
    Push-Location $WorkingDirectory
    try {
      & $Executable @Arguments
      if ($LASTEXITCODE -ne 0) {
        throw "$Executable exited with code $LASTEXITCODE."
      }
      "Command completed successfully."
    } finally {
      Pop-Location
    }
  }
}

function ConvertFrom-Base64Url {
  param([string]$Value)

  $normalized = $Value.Replace("-", "+").Replace("_", "/")
  switch ($normalized.Length % 4) {
    2 { $normalized += "==" }
    3 { $normalized += "=" }
  }
  [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($normalized))
}

function Test-TrackedSecrets {
  $trackedFiles = & git -C $repoRoot ls-files
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to enumerate tracked files."
  }

  $findings = [System.Collections.Generic.List[string]]::new()
  foreach ($relativePath in $trackedFiles) {
    $absolutePath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
      continue
    }

    $content = [IO.File]::ReadAllText($absolutePath)
    if ($content -match 'sb_secret_[A-Za-z0-9_-]{12,}') {
      $findings.Add("$relativePath contains a Supabase secret-key-shaped value")
    }

    foreach ($match in [regex]::Matches($content, 'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}')) {
      try {
        $parts = $match.Value.Split('.')
        $payload = ConvertFrom-Base64Url $parts[1] | ConvertFrom-Json
        if ($payload.role -eq "service_role") {
          $findings.Add("$relativePath contains a legacy service-role JWT")
        }
      } catch {
        # A JWT-shaped string that cannot be decoded is not reported as a secret.
      }
    }
  }

  if ($findings.Count -gt 0) {
    throw ($findings -join "; ")
  }
  "No active Supabase secret-key or service-role JWT values found in tracked files."
}

function Test-NoClientSecretReferences {
  $clientRoots = @(
    (Join-Path $repoRoot "mobile"),
    (Join-Path $repoRoot "web-admin\app"),
    (Join-Path $repoRoot "web-admin\components")
  ) | Where-Object { Test-Path -LiteralPath $_ }

  $findings = [System.Collections.Generic.List[string]]::new()
  foreach ($root in $clientRoots) {
    Get-ChildItem -LiteralPath $root -File -Recurse |
      Where-Object { $_.Extension -in @(".ts", ".tsx", ".js", ".jsx", ".json") } |
      ForEach-Object {
        $content = [IO.File]::ReadAllText($_.FullName)
        if ($content -match 'NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET)[A-Z0-9_]*' -or
            $content -match 'EXPO_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET)[A-Z0-9_]*') {
          $findings.Add($_.FullName.Substring($repoRoot.Length + 1))
        }
      }
  }

  if ($findings.Count -gt 0) {
    throw "Client-exposed secret environment variable reference found in: $($findings -join ', ')"
  }
  "No secret/service environment variables use a public client prefix."
}

function Test-NewKeyCompatibilityMarkers {
  $serverSource = [IO.File]::ReadAllText((Join-Path $repoRoot "web-admin\lib\supabase\server.ts"))
  $edgeSource = Get-ChildItem -LiteralPath (Join-Path $repoRoot "supabase\functions") -File -Recurse -Filter "*.ts" |
    ForEach-Object { [IO.File]::ReadAllText($_.FullName) }
  $workerSource = [IO.File]::ReadAllText((Join-Path $repoRoot "toolkit\sync_engine\worker.py"))

  $missing = [System.Collections.Generic.List[string]]::new()
  if ($serverSource -notmatch 'SUPABASE_SECRET_KEY') { $missing.Add("web-admin") }
  if (($edgeSource -join "`n") -notmatch 'SUPABASE_SECRET_KEYS') { $missing.Add("Edge Functions") }
  if ($workerSource -notmatch 'SUPABASE_SECRET_KEY') { $missing.Add("sync worker") }

  if ($missing.Count -gt 0) {
    throw "New-key compatibility has not been implemented for: $($missing -join ', ')."
  }
  "Web admin, Edge Functions, and sync worker contain new-key compatibility paths."
}

function Assert-SupabaseUrl {
  if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
    throw "FLOCKTRAX_SUPABASE_URL is required for production probes."
  }
  $uri = [Uri]$SupabaseUrl
  if ($uri.Scheme -ne "https" -or -not $uri.Host.EndsWith(".supabase.co", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Production probes only send credentials to an HTTPS *.supabase.co endpoint."
  }
  $uri.GetLeftPart([UriPartial]::Authority).TrimEnd('/')
}

function Invoke-SafeHttpProbe {
  param(
    [string]$Uri,
    [hashtable]$Headers = @{},
    [string]$Method = "GET"
  )

  $handler = [Net.Http.HttpClientHandler]::new()
  $client = [Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(30)
  try {
    $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::$Method, $Uri)
    foreach ($header in $Headers.GetEnumerator()) {
      [void]$request.Headers.TryAddWithoutValidation($header.Key, [string]$header.Value)
    }
    $response = $client.Send($request)
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Body = $body
    }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

function Test-KeyReadAccess {
  param(
    [string]$Name,
    [string]$BaseUrl,
    [string]$Key,
    [bool]$ShouldSucceed
  )

  if ([string]::IsNullOrWhiteSpace($Key)) {
    Add-Result -Name $Name -Status "SKIP" -Detail "Credential was not supplied through the dedicated environment variable."
    return
  }

  Invoke-Check -Name $Name -Check {
    $headers = @{ apikey = $Key }
    if ($Key.StartsWith("eyJ", [StringComparison]::Ordinal)) {
      $headers.Authorization = "Bearer $Key"
    }
    $result = Invoke-SafeHttpProbe -Uri "$BaseUrl/rest/v1/farms?select=id&limit=1" -Headers $headers
    $success = $result.StatusCode -ge 200 -and $result.StatusCode -lt 300

    if ($ShouldSucceed -and -not $success) {
      throw "Expected read access but received HTTP $($result.StatusCode)."
    }
    if (-not $ShouldSucceed -and $success) {
      throw "Legacy key still has read access (HTTP $($result.StatusCode))."
    }
    if (-not $ShouldSucceed -and $result.StatusCode -notin @(401, 403)) {
      throw "Expected HTTP 401/403 for a revoked key but received HTTP $($result.StatusCode)."
    }
    if ($ShouldSucceed) { "Read-only backend probe succeeded." } else { "Legacy key was rejected." }
  }
}

Invoke-Check -Name "Tracked repository secret scan" -Check { Test-TrackedSecrets }
Invoke-Check -Name "Client secret-reference scan" -Check { Test-NoClientSecretReferences }

if ($Stage -in @("Cutover", "Revoked")) {
  Invoke-Check -Name "New Supabase key compatibility" -Check { Test-NewKeyCompatibilityMarkers }
}

if (-not $SkipLocalChecks) {
  Invoke-LocalCommand -Name "Web admin typecheck" -WorkingDirectory (Join-Path $repoRoot "web-admin") -Executable "npm.cmd" -Arguments @("run", "typecheck")
  Invoke-LocalCommand -Name "Web admin production build" -WorkingDirectory (Join-Path $repoRoot "web-admin") -Executable "npm.cmd" -Arguments @("run", "build")
  Invoke-LocalCommand -Name "Mobile typecheck" -WorkingDirectory (Join-Path $repoRoot "mobile") -Executable "npm.cmd" -Arguments @("run", "typecheck")
}

if ($RunProductionProbes) {
  $baseUrl = Assert-SupabaseUrl

  Invoke-Check -Name "Production website availability" -Check {
    $result = Invoke-SafeHttpProbe -Uri $WebUrl
    if ($result.StatusCode -lt 200 -or $result.StatusCode -ge 400) {
      throw "Website returned HTTP $($result.StatusCode)."
    }
    "Website returned HTTP $($result.StatusCode)."
  }

  if ([string]::IsNullOrWhiteSpace($PublicKey)) {
    Add-Result -Name "Public API health" -Status "SKIP" -Detail "FLOCKTRAX_PUBLIC_KEY was not supplied."
  } else {
    Invoke-Check -Name "Public API health" -Check {
      $result = Invoke-SafeHttpProbe -Uri "$baseUrl/auth/v1/settings" -Headers @{ apikey = $PublicKey }
      if ($result.StatusCode -lt 200 -or $result.StatusCode -ge 300) {
        throw "Public Auth endpoint returned HTTP $($result.StatusCode)."
      }
      "Public Auth endpoint accepted the public key."
    }

    Invoke-Check -Name "Privileged worker rejects public callers" -Check {
      $result = Invoke-SafeHttpProbe `
        -Uri "$baseUrl/functions/v1/googleapis-outbox-process" `
        -Method "POST" `
        -Headers @{ apikey = $PublicKey }
      if ($result.StatusCode -notin @(401, 403)) {
        throw "Expected HTTP 401/403 but received HTTP $($result.StatusCode)."
      }
      "Privileged worker rejected the public key."
    }
  }

  Test-KeyReadAccess -Name "New secret-key backend access" -BaseUrl $baseUrl -Key $NewSecretKey -ShouldSucceed $true

  if ([string]::IsNullOrWhiteSpace($NewSecretKey)) {
    Add-Result -Name "New secret-key Edge authorization" -Status "SKIP" -Detail "FLOCKTRAX_NEW_SECRET_KEY was not supplied."
  } else {
    Invoke-Check -Name "New secret-key Edge authorization" -Check {
      $result = Invoke-SafeHttpProbe `
        -Uri "$baseUrl/functions/v1/weight-entry-get" `
        -Headers @{ apikey = $NewSecretKey }
      if ($result.StatusCode -ne 400) {
        throw "Expected safe validation response HTTP 400 but received HTTP $($result.StatusCode)."
      }
      "Edge Function accepted the secret and stopped at input validation."
    }
  }

  if ($Stage -eq "Cutover") {
    Test-KeyReadAccess -Name "Legacy key overlap access" -BaseUrl $baseUrl -Key $LegacyServiceRoleKey -ShouldSucceed $true
  } elseif ($Stage -eq "Revoked") {
    Test-KeyReadAccess -Name "Legacy key revocation" -BaseUrl $baseUrl -Key $LegacyServiceRoleKey -ShouldSucceed $false
  }

  if ([string]::IsNullOrWhiteSpace($TestAccessToken) -or [string]::IsNullOrWhiteSpace($PublicKey)) {
    $status = if ($RequireAuthenticatedProbe) { "FAIL" } else { "SKIP" }
    Add-Result -Name "Authenticated user session" -Status $status -Detail "FLOCKTRAX_TEST_ACCESS_TOKEN and FLOCKTRAX_PUBLIC_KEY are required."
  } else {
    Invoke-Check -Name "Authenticated user session" -Check {
      $headers = @{
        apikey = $PublicKey
        Authorization = "Bearer $TestAccessToken"
      }
      $result = Invoke-SafeHttpProbe -Uri "$baseUrl/auth/v1/user" -Headers $headers
      if ($result.StatusCode -ne 200) {
        throw "Authenticated session probe returned HTTP $($result.StatusCode)."
      }
      "Test-user access token remains valid."
    }
  }
}

Write-Host ""
Write-Host "FlockTrax Release 1 verification: $Stage"
$script:Results | Format-Table -AutoSize -Wrap
Write-Host "PASS=$script:Passed FAIL=$script:Failed SKIP=$script:Skipped"

if ($script:Failed -gt 0) {
  exit 1
}
exit 0
