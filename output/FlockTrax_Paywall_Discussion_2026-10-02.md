# FlockTrax Paywall Discussion — 2026-10-02

Status: discussion and pricing hypotheses to revisit. NOT approved pricing, an implementation requirement, or authorization to introduce billing or restrict access. Summary of the conversation, not a verbatim transcript.

Related: [Enterprise Environment Architecture Discussion](FlockTrax_Enterprise_Environment_Architecture_Discussion_2026-10-02.md).

## Ken's original commercial direction

Ken favors subscription/per-user pricing for most customers. An integrator seeking non-exclusive use and control might instead purchase a license for a flat fee or enter a term lease. The feasibility of a maintainable paywall was discussed before choosing a payment provider or defining final commercial terms.

## Proposed billing and entitlement design

Keep three independent layers:
- Billing: payments, invoices, renewals, purchased capacity.
- Entitlements: customer subscription/license status, enabled features, seat or capacity allowance, term.
- Permissions: individual roles and farm memberships. Payment never overrides access restrictions.

Use an established billing provider rather than building payment processing. Provider events update FlockTrax entitlement status. One shared entitlement model can represent trials, subscriptions, and enterprise agreements. No provider has been selected.

For a per-user model, the customer business would buy and assign named seats rather than requiring workers to subscribe individually. Define precisely what is billable: enabled account, assigned seat, or monthly active user. Named assigned seats were the initial suggestion for understandable billing; this was later reconsidered as the primary pricing metric (see below).

Enforcement belongs in shared server-side checks covering APIs and database access paths, including mobile/direct-client access. Hiding UI controls alone is insufficient. Every access path needs an audit before enforcement can be considered complete.

Support tooling would manage assignments, grace periods, and documented exceptions with an audit trail. Customer profiles could reside in the proposed support-managed registry; privileged credentials remain in a secrets manager.

Deployments should retain a last verified entitlement for a bounded period so billing/registry outages do not halt farm work. This allowance must expire and must not bypass normal authentication or farm permissions.

## Suspension and enterprise licensing questions

Before implementation, define renewal notices, payment-failure grace periods, new-seat restrictions, eventual suspension behavior, and continued access to historical records/exports. Avoid an accidental abrupt shutdown of essential daily operations merely because a card expired. The precise policy remains undecided.

Enterprise terms might cover an integrator, specified farms/barns, modules, or a contract duration. Permanent use rights must be distinguished from ongoing hosting, support, maintenance, and upgrades.

If an integrator controls application source, hosting, and database, technical license enforcement cannot be promised to be unbypassable. Contractual terms become the primary control. Integrator ownership of only its operational database is a different arrangement from ownership/control of the whole application stack.

The assessment was that this is doable and maintainable using standard components and centralized rules. That assessment is not a completed implementation design or access-path audit.

## Starting-price discussion

Ken had been considering a substantially lower number and found the proposed starting point logically supported. That response did not select a final price or authorize publication.

The assistant suggested testing $99–$149 per farm per month, making the first offer at $149. These are commercial hypotheses, not a valuation established by customer willingness to pay.

Suggested initial package:

| Item | Proposed price/terms |
|---|---|
| One farm, up to four barns, standard operational features | $149/month |
| Additional barns at that farm | $20/barn/month |
| Annual payment for the base package | $1,490/year |
| Routine staff accounts | Included, with individual logins |
| Custom imports, integrations, extensive training | Separately quoted |

An eight-barn farm would be $229/month under this formula. Annual additional-barn terms, multi-farm discounts, routine support boundaries, hosting costs, and exceptions have not been set.

Why reconsider per-user pricing: value appears to track operating scale/barns more closely than headcount. Charging every worker can encourage shared accounts or omitted users, undermining accountability. A small crew running many barns can receive more value than a larger crew running fewer barns. Ken's original per-user preference remains part of the discussion; a switch to farm/barn pricing has not been formally agreed.

## Evidence and value reasoning

FlockTrax already supports Ken's real daily collection, feed inputs/ordering, placements, livehaul, and closeout. Potential value includes less time preparing orders, consistent records, accountability, coordinated workflows, and less paper/spreadsheet reconciliation. Independent customer benefits and support costs still need measurement.

Illustrative arithmetic only: saving 20 minutes daily at an owner-assigned $30/hour is roughly $300 per 30-day month. This is not measured FlockTrax savings or a marketing claim.

The purchaser may not pay for feed. Growers may value time, convenience, records and documentation, while integrators may value coordination and feed logistics. Do not attribute feed-cost savings to a grower who does not bear those costs.

Market reference checked during discussion: Farmbrite listed livestock plans at $29/$49/$79 monthly and complete plans at $59/$79/$109 monthly; some include unlimited team members, with custom enterprise arrangements. This establishes competition below $150, not feature equivalence or evidence that customers will pay a FlockTrax premium. Recheck before future use: https://www.farmbrite.com/pricing .

## Suggested validation and next discussion

- Test with three to five external paying farms for a full flock cycle, starting with the proposed $149 package.
- Observe willingness to pay, work replaced, onboarding effort, and ongoing support burden.
- If appropriate, use a clearly defined founding-customer discount with a limited term rather than permanently underpricing the product.
- Evaluate unit economics, including hosting, payment processing, support, training, and integration maintenance before committing to an offer.
- For integrators, begin with a defined paid pilot, then quote an annual arrangement based on scope, dedicated environment, integrations, onboarding, support commitments, and control rights. No enterprise dollar amount was established.
- Price non-exclusive perpetual use, source access, hosting, support and upgrades explicitly so a one-time fee does not accidentally buy indefinite services.

No billing provider account, checkout, paywall, subscription, customer restriction, public price page, or enterprise contract is to be created solely on the basis of this note.
