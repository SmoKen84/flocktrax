param([string]$Container = 'supabase_db_FlockTrax')
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$testDatabase = 'codex_reinstate_test_' + [guid]::NewGuid().ToString('N')
$created = $false
function Invoke-TestSql([string]$Sql) {
    $Sql | docker exec -i $Container psql -X -v ON_ERROR_STOP=1 -U postgres -d $testDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Placement reinstatement SQL test failed.' }
}
try {
    docker exec $Container createdb -U postgres $testDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Could not create disposable test database.' }
    $created = $true
    Invoke-TestSql @'
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
create extension btree_gist;
'@
    $baseline = Get-Content -Raw (Join-Path $repoRoot 'supabase/migrations/20260827181000_hosted_schema_baseline.sql')
    foreach ($table in @('farms','barns','flocks','placements','feed_drops','feed_order_commitments','roles','user_roles','farm_memberships','farm_group_memberships','activity_log','log_daily','log_mortality','log_weight')) {
        $pattern = 'CREATE TABLE IF NOT EXISTS "public"\."' + $table + '" \([\s\S]*?\r?\n\);'
        $match = [regex]::Match($baseline, $pattern)
        if (-not $match.Success) { throw "Missing baseline table: $table" }
        Invoke-TestSql $match.Value
    }
    foreach ($function in @('sync_barn_current_state','placements_sync_barn_state','flocks_sync_barn_state')) {
        $pattern = 'CREATE OR REPLACE FUNCTION "public"\."' + $function + '"[\s\S]*?\$\$;'
        $match = [regex]::Match($baseline, $pattern)
        if (-not $match.Success) { throw "Missing baseline function: $function" }
        Invoke-TestSql $match.Value
    }
    Invoke-TestSql @'
create trigger test_placements_sync after insert or update on placements for each row execute function placements_sync_barn_state();
create trigger test_flocks_sync after update of is_in_barn,is_active on flocks for each row execute function flocks_sync_barn_state();
create unique index idx_unique_active_placement_per_barn on placements(barn_id) where is_active=true and date_removed is null;
alter table placements add constraint placements_no_overlap_per_barn exclude using gist
  (barn_id with =, daterange(active_start,coalesce(active_end,'infinity'::date),'[)') with &&)
  where (lifecycle_stage <> 'canceled');
'@
    Invoke-TestSql (Get-Content -Raw (Join-Path $repoRoot 'supabase/migrations/20260922130000_fix_cancel_feed_drop_columns.sql'))
    Invoke-TestSql (Get-Content -Raw (Join-Path $repoRoot 'supabase/migrations/20261001150000_placement_reinstatement.sql'))
    Invoke-TestSql (Get-Content -Raw (Join-Path $repoRoot 'supabase/migrations/20261001153000_reinstatement_previous_placement_boundary.sql'))
    Invoke-TestSql (Get-Content -Raw (Join-Path $repoRoot 'supabase/migrations/20261001160000_fix_reinstatement_active_barn_slot.sql'))
    Invoke-TestSql (Get-Content -Raw (Join-Path $repoRoot 'supabase/tests/placement_reinstatement.sql'))
    Write-Host 'Placement reinstatement SQL regression checks passed.'
} finally {
    if ($created -and $testDatabase -match '^codex_reinstate_test_[a-f0-9]{32}$') {
        docker exec $Container dropdb -U postgres $testDatabase
    }
}
