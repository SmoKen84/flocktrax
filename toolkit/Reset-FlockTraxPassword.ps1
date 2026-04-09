param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$NewPassword,

  [string]$ProjectRef = "frneaccbbrijpolcesjm",

  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
  throw "SUPABASE_SERVICE_ROLE_KEY is required. Pass -ServiceRoleKey or set the environment variable first."
}

if ([string]::IsNullOrWhiteSpace($Email)) {
  throw "Email is required."
}

if ([string]::IsNullOrWhiteSpace($NewPassword)) {
  throw "NewPassword is required."
}

$baseUrl = "https://$ProjectRef.supabase.co"
$headers = @{
  apikey        = $ServiceRoleKey
  Authorization = "Bearer $ServiceRoleKey"
  "Content-Type" = "application/json"
}

Write-Host "Looking up user for $Email in project $ProjectRef..."

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

$user = $users | Where-Object { $_.email -eq $Email } | Select-Object -First 1

if ($null -eq $user) {
  throw "No auth user found for email '$Email'."
}

$body = @{
  password = $NewPassword
} | ConvertTo-Json

Write-Host "Updating password for user id $($user.id)..."

$updated = Invoke-RestMethod `
  -Method Put `
  -Uri "$baseUrl/auth/v1/admin/users/$($user.id)" `
  -Headers $headers `
  -Body $body

$result = [PSCustomObject]@{
  ok      = $true
  user_id = $updated.id
  email   = $updated.email
}

$result | ConvertTo-Json
