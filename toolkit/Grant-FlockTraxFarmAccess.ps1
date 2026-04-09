param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [string]$FarmId,

  [string]$RoleId,

  [string]$ProjectRef = "frneaccbbrijpolcesjm",

  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
  throw "SUPABASE_SERVICE_ROLE_KEY is required. Pass -ServiceRoleKey or set the environment variable first."
}

$baseUrl = "https://$ProjectRef.supabase.co"
$headers = @{
  apikey         = $ServiceRoleKey
  Authorization  = "Bearer $ServiceRoleKey"
  "Content-Type" = "application/json"
}

function Get-AuthUserByEmail {
  param([string]$TargetEmail)

  $usersResponse = Invoke-RestMethod `
    -Method Get `
    -Uri "$baseUrl/auth/v1/admin/users?page=1&per_page=1000" `
    -Headers $headers

  $users = @()
  if ($usersResponse -is [System.Array]) {
    $users = $usersResponse
  } elseif ($null -ne $usersResponse.users) {
    $users = $usersResponse.users
  }

  return $users | Where-Object { $_.email -eq $TargetEmail } | Select-Object -First 1
}

function Invoke-RestSelect {
  param([string]$Path)

  Invoke-RestMethod `
    -Method Get `
    -Uri "$baseUrl/rest/v1/$Path" `
    -Headers $headers
}

$user = Get-AuthUserByEmail -TargetEmail $Email
if ($null -eq $user) {
  throw "No auth user found for email '$Email'."
}

if ([string]::IsNullOrWhiteSpace($FarmId)) {
  Write-Host "User found: $($user.id) / $($user.email)"
  Write-Host ""
  Write-Host "Current farm memberships:"

  $memberships = Invoke-RestSelect -Path "farm_memberships?user_id=eq.$($user.id)&select=user_id,farm_id,role_id,is_active,created_at,updated_at"
  if ($null -eq $memberships -or $memberships.Count -eq 0) {
    Write-Host "  none"
  } else {
    $memberships | ConvertTo-Json -Depth 5
  }

  Write-Host ""
  Write-Host "Available farms:"
  $farms = Invoke-RestSelect -Path "farms?select=id,farm_code,farm_name,is_active&order=farm_name"
  $farms | ConvertTo-Json -Depth 5
  return
}

$payload = @{
  user_id   = $user.id
  farm_id   = $FarmId
  is_active = $true
}

if (-not [string]::IsNullOrWhiteSpace($RoleId)) {
  $payload.role_id = $RoleId
}

$jsonBody = @($payload) | ConvertTo-Json -Depth 5
$upsertHeaders = @{
  apikey         = $ServiceRoleKey
  Authorization  = "Bearer $ServiceRoleKey"
  "Content-Type" = "application/json"
  Prefer         = "resolution=merge-duplicates,return=representation"
}

$result = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/rest/v1/farm_memberships?on_conflict=user_id,farm_id" `
  -Headers $upsertHeaders `
  -Body $jsonBody

$out = [PSCustomObject]@{
  ok          = $true
  email       = $Email
  user_id     = $user.id
  farm_id     = $FarmId
  role_id     = $RoleId
  memberships = $result
}

$out | ConvertTo-Json -Depth 6
