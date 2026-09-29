param([string]$Container = 'supabase_db_FlockTrax')
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$testDatabase = 'codex_mortality_test_' + [guid]::NewGuid().ToString('N')
$created = $false

function Invoke-TestSql([string]$Sql) {
    $Sql | docker exec -i $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d $testDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Mortality SQL test failed.' }
}

try {
    docker exec $Container createdb -U postgres $testDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Could not create disposable test database.' }
    $created = $true
    Invoke-TestSql @'
create table public.flocks (id uuid primary key, date_placed date);
create table public.placements (id uuid primary key, flock_id uuid);
create table public.log_mortality (
  id uuid primary key, placement_id uuid, log_date date,
  dead_female integer, dead_male integer, cull_female integer, cull_male integer, is_active boolean
);
create unique index on public.log_mortality (placement_id, log_date);
grant select on all tables in schema public to service_role;
'@
    Invoke-TestSql (Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'supabase/migrations/20260929120000_add_mortality_window_summary.sql'))
    Invoke-TestSql (Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'supabase/tests/mortality_window.sql'))
    Write-Host 'Mortality SQL regression checks passed.'
}
finally {
    # Only remove the uniquely named database this invocation created.
    if ($created -and $testDatabase -match '^codex_mortality_test_[a-f0-9]{32}$') {
        docker exec $Container dropdb -U postgres $testDatabase
        if ($LASTEXITCODE -ne 0) { Write-Warning "Test database cleanup failed: $testDatabase" }
    }
}
