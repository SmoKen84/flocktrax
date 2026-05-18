

cd C:\dev\FlockTrax

$backupDir = "C:\dev\FlockTrax\backups\2026-04-17-pre-alpha-reset"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$dbUrl = "postgresql://postgres.frneaccbbrijpolcesjm:tvwTy4xMsEckRT5t@aws-0-us-east-1.pooler.supabase.com:5432/postgres"


supabase db dump --db-url $dbUrl -f "$backupDir\roles.sql" --role-only
supabase db dump --db-url $dbUrl -f "$backupDir\schema.sql"
supabase db dump --db-url $dbUrl -f "$backupDir\data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
