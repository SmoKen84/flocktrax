# FlockTrax enterprise environment architecture discussion — 2026-10-02

Status: planning reference and architectural direction, NOT an implementation request or an approved infrastructure project. Revisit as customers and requirements develop. This note summarizes the discussion; it is not a verbatim transcript.

## Why we discussed this

Ken wants to avoid architectural decisions now that would create a barrier to industry adoption later. The concern is not an immediate capacity ceiling or a request to replace Supabase. Thinking through deployment ownership and separation early should prevent expensive cleanup when an integrator adopts FlockTrax.

## Existing operational foundation

- Smotherman Farms production supports real daily collection, feed inputs, all feed ordering, placements, livehaul, and closeout. Its records include data backdated to January 1, 2026; that is not a claim that every application feature was live on that date.
- A separate demo application and Supabase database let prospects test the system without altering production operations.
- Ken noted that the demo split was not a clean configuration/profile separation. Remaining assumptions need an inventory; no comprehensive portability audit has been performed.
- Production use demonstrates usefulness at the current workload, not yet a measured guarantee of enterprise-scale capacity or customer isolation.

## Capacity discussion

Supabase uses PostgreSQL. There is no established number of farms, users, or records at which FlockTrax must migrate. Query cost, concurrent writes, locking, reporting load, recovery requirements, and available resources matter more than record count alone.

Broad reporting queries are a plausible early source of performance pressure, but degradation is not guaranteed to be gradual. Bursts, expensive queries, and lock contention can expose bottlenecks suddenly. Monitoring and realistic load testing should guide decisions.

Options before changing platforms include query/index improvements, pagination and database-side aggregation, report summaries, larger compute, partitioning, and separating reporting from operational work. Read replicas help reads; writes still use the primary. None of these changes is requested now.

If a hosting change eventually becomes necessary, retaining PostgreSQL compatibility is the preferred starting point. Aurora PostgreSQL was discussed as a candidate to evaluate, not a selected destination. A single-writer bottleneck may require distributing independent customer workloads or another architectural change, not merely moving to a different host. Authentication, APIs, storage, functions, and integrations must also be accounted for in migration.

Reference sources reviewed in the discussion (recheck product limits and capabilities before using them for a decision):
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/compute-and-disk
- https://supabase.com/docs/guides/platform/read-replicas
- https://www.postgresql.org/docs/current/limits.html
- https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_Limits.html

## Proposed customer deployment direction

Ken's planning assumption is that a large integrator would require its own separately provisioned database/project and likely control over the resources its farms update. Separate projects under a Smotherman Farms organization were discussed as one support-friendly arrangement; integrator-owned projects must also be considered. These are customer requirements to establish, not universal requirements already verified with prospective customers. Separate Supabase projects do not, by themselves, mean customer-owned physical hardware.

Prefer one shared FlockTrax codebase with a separate application deployment and Supabase project for each integrator. Avoid manually maintained application forks. Runtime switching among projects in a single application remains a possible alternative, but is not the preferred starting point because it complicates routing, sessions, caches, jobs, and support access.

A deployment profile may contain:
- Customer/integrator identifier and environment type (production, demo, test).
- Supabase project reference/URL and public application key.
- Secret-manager references for privileged credentials.
- Application domain, authentication redirects, and approved enrollment configuration.
- Integration settings and secret references, including BinSentry and other external services.
- Branding and enabled features.
- Application release and database migration version/status.

Workers should reach the correct environment through its application address or an approved enrollment flow. They should not enter database credentials or freely browse customer databases. Profile configuration must be available before querying the operational database. Mobile application distribution and environment enrollment remain open design questions.

## Central support-managed environment registry

Ken proposed a separate central database containing these profiles, configurable only by authorized FlockTrax support personnel. This is the proposed administrative registry, not a repository for customers' farm operating data.

Design principles discussed:
- Limit changes to authorized support staff and audit who changed what.
- Store privileged credentials in a secrets manager; keep references in the registry. Never ship service-role credentials to browsers or mobile clients.
- Each deployment retains its last approved configuration so registry unavailability does not stop daily farm operations.
- The registry should not be involved in every data read, save, feed transaction, or report.
- Customer project ownership and delegated support permissions must be explicit. A registry entry does not grant access to an integrator-owned project.
- Central deployment tooling tracks each customer's application and schema version and the outcome of each migration. Updates must be tested and applied deliberately; shared code does not imply every customer can be upgraded simultaneously.

## Guidelines to apply to ongoing development

1. Keep customer identities, project endpoints, and credentials out of business logic.
2. Separate environment configuration from operational farm data.
3. Maintain a shared codebase and ordered migration history; represent customer variation as explicit configuration where appropriate.
4. Keep integrations, background jobs, storage references, authentication settings, and caches bound to the correct customer/environment.
5. Use the production/demo separation to expose remaining hard-coded assumptions.
6. Preserve PostgreSQL portability without claiming Supabase-specific services are interchangeable with another host.
7. Flag changes that would make independent deployment or support difficult, but do not build speculative infrastructure as part of unrelated feature work.

## When to revisit / open questions

Revisit before the first external integrator production deployment, when making major authentication/integration changes, or when measured growth warrants capacity work.

At that point, inventory configuration assumptions; agree project ownership, support access and isolation boundaries; decide mobile enrollment and domain routing; design registry bootstrap/configuration approval and secret rotation; establish staged migration/rollback procedures; and validate representative load, customer isolation, backups/restoration, recovery objectives, and monitoring.

No registry, new customer database, infrastructure migration, automation, or platform deployment is authorized by saving this discussion. No claim is made that all architectural obstacles have been audited away.
