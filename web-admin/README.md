# FlockTrax Web Admin

Web-first admin console for FlockTrax operations, setup, and reporting.

## Milestone 1

- Overview dashboard
- Farms module
- Flocks module
- Placement allocation wizard

## Local dev

```powershell
npm install
npm run dev
```

For live admin data, add these values to `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
