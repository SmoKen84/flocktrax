# Automatic demo signup — local implementation

The marketing app now sends an encrypted email-verification link. Opening the email link automatically verifies the address and returns to the preserved request form. Verification alone does not create an account. The visitor then presses Send Demo Request, which creates a private evaluator record, alias-only auth account, role assignment and farm membership where required, then emails the branded setup link and notifies Ken.

Integrator Manager selection maps to integrator_manager. All other choices map to farm_manager with Cedar Creek Farm by default. Access is 30 days; verification and single-use setup links expire after 24 hours. Existing records retain their original role; repeated submissions do not upgrade or renew them. Disabled/expired accounts require owner review. Grower Admin support remains unfinished.

Server-only local settings: DEMO_SIGNUP_SUPABASE_URL, DEMO_SIGNUP_SERVICE_KEY, DEMO_SIGNUP_SECRET, DEMO_SIGNUP_FARM_ID, DEMO_SIGNUP_ORIGIN, plus existing SMTP settings. Keep the signing secret stable. The database binding is locked to the isolated demo project. Never use production Supabase credentials for this workflow. Do not commit .env.local.

Local verification URLs use http://127.0.0.1:4173 and only work on this computer. Vite proxies verification and API routes to port 4174. Before deployment configure DEMO_SIGNUP_ORIGIN=https://flocktrax.com and the server-only secrets in the hosting environment. Production rejects a localhost verification origin.

Live local test: one Farm Manager record created for Ken's mailbox, scoped to Cedar Creek Farm; SMTP accepted welcome and owner notification. Duplicate confirmation returned already-sent; record count remained one. Verification email sent via the request endpoint. Invalid verification token rejected. Password completion and mailbox rendering still require recipient verification.

Known operational limits: request rate limiting is per process, not shared across hosting instances. Configure a hosting firewall rate limit before public release. Concurrent confirmations can send duplicate copies of the same setup email but do not create duplicate auth accounts. Delivery tracking is saved in admin-only auth metadata. Owner-notification failure is logged; no durable email queue is implemented. The demo register supports name/company filters and sorting. My Permissions shows a membership hierarchy and Dos / Can’t Dos. Evaluator requests for User Access redirect to their read-only report.
