# FlockTrax BioWaste and WQMP Planning Checkpoint

Date: `2026-08-28`
Branch: `main`
Source commit: `6e6bcb9`
Checkpoint type: research, product specification, and implementation-decision stopping point

## Purpose

This checkpoint preserves the researched requirements and current product decisions
for a new FlockTrax BioWaste module supporting Texas dry-litter poultry Water Quality
Management Plans (WQMPs), also referred to operationally as nutrient-management plans.

No BioWaste database migration or application implementation has been started from
this specification. The current stopping point is ready for requirements confirmation
and implementation planning.

## Authoritative Planning Artifacts

- `output/FlockTrax_BioWaste_WQMP_Project_Spec_2026-08-27.md`
  - editable source specification;
  - Section 11 contains the latest business decisions recorded on `2026-08-28`.
- `output/FlockTrax_BioWaste_WQMP_Project_Spec_2026-08-27.docx`
  - formatted 19-page reference copy created before the Section 11 answers were added;
  - intentionally not updated with the latest Section 11 decisions.

The Markdown file is therefore the controlling version when work resumes.

## Planned Module Scope

The specification calls for a new top-level **BioWaste** sidebar group located below
**Placements** and above **Configuration**, with at least:

- **BioWaste Tracker**;
- **Responsible Entities**.

The proposed record chain traces material from farm, barn, placement/flock, and input
through waste generation, laboratory analysis, storage, on-farm use, third-party
transfer, and final supporting documentation.

The data model separates:

- bedding and other input records;
- generated waste batches;
- storage, use, transfer, and disposal events;
- responsible recipients, haulers, and other entities;
- laboratory samples and reports;
- land-management units and land-application details;
- WQMP inspections, reviews, incidents, and corrective actions;
- private supporting documents and immutable audit history.

## Confirmed Business Decisions

1. All farms in scope will be **dry-litter** operations.
2. A representative certified WQMP and its current transfer/application forms are
   still pending and must be obtained before finalizing farm-specific fields.
3. The general operating quantity will be **estimated cubic yards**.
4. Input materials will be recorded by reference only; vendor invoices or other
   input documents are not required.
5. Correction approvals and voids require `farm_membership` authority at the
   `farm_manager` role or above for the applicable farm.
6. An uploaded signed disposal receipt is sufficient; a recipient portal or platform
   signature is not required initially.
7. FlockTrax should issue the disposal receipt, number it sequentially, and include
   the data required by the applicable WQMP regulations.
8. A configurable `platform.setting` prefix must precede the sequential receipt
   identifier. The approved pattern is `SmoFarm-WQMP-YR-####`, where `YR` is the
   two-digit issue year and `####` is the sequence number.
9. `wqmp_last_audit_date` will primarily represent the TSSWCB/SWCD annual inspection.
   Other inspection and review dates belong in normalized compliance-event records.

## Research and Design Baseline

The specification records the current baseline derived from TSSWCB, Texas statutes,
TCEQ, and Texas NRCS materials, including:

- maintaining the certified, site-specific WQMP and related implementation records;
- annual litter/manure and applicable soil analyses;
- on-farm use and land-application logs;
- off-site transfer identity, destination, date, quantity, and receipt evidence;
- proof that the applicable nutrient analysis was supplied to a recipient or hauler;
- mortality-management, storage, inspection, incident, and corrective-action records;
- a default system retention target of at least five years;
- private document storage, controlled corrections, and durable audit history.

The actual certified farm WQMP, current agency rules, and any applicable TCEQ permit
remain controlling. The representative WQMP/forms review is the next requirements
gate before schema details are treated as final.

## Implementation Boundary

At this checkpoint:

- no BioWaste schema migration has been authored or applied;
- no BioWaste sidebar routes or application screens have been implemented;
- no receipt sequence or receipt document generator has been implemented;
- no hosted database or production application changes were made for BioWaste;
- the formatted DOCX should not be treated as current for Section 11 decisions.

The repository already contains a broad, unrelated dirty working tree from other
FlockTrax worklines. Preserve those changes and do not attempt a broad cleanup or
whole-tree reversion when beginning BioWaste implementation.

## Resume

1. Load this checkpoint, `FlockTrax_Checkpoint_Index.md`, and the Markdown project
   specification.
2. Treat the Markdown specification as authoritative over the existing DOCX.
3. Obtain and review one representative certified WQMP plus its current
   litter-transfer/application forms.
4. Confirm the exact legally and operationally required disposal-receipt fields.
5. Convert the approved specification into a staged migration and application plan,
   following `supabase/MIGRATIONS.md` and the current rebased migration tree.
6. Define receipt-sequence behavior, including per-year reset, concurrency safety,
   uniqueness, immutability after issuance, and correction/void treatment, while
   retaining the approved `SmoFarm-WQMP-YR-####` display pattern.
7. Begin with the farm WQMP fields, responsible entities, BioWaste input/batch/event
   foundation, RLS, audit fields, and the two required sidebar destinations.

Suggested resume prompt:

`Load FlockTrax_BioWaste_WQMP_Planning_Checkpoint_2026-08-28.md, FlockTrax_Checkpoint_Index.md, and the BioWaste WQMP Markdown specification. Resume from the planning boundary: all farms are dry-litter, quantities are generally estimated cubic yards, inputs are reference-only, farm_manager or above controls approvals and voids, signed FlockTrax-issued sequential disposal receipts are sufficient, and a representative certified WQMP/form set is still pending before final schema implementation.`
