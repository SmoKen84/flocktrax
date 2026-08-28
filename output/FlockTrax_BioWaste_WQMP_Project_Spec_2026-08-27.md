# FlockTrax BioWaste and WQMP Compliance Tracking

## Project specification

**Status:** Research and initial design  
**Prepared:** August 27, 2026  
**Scope:** Texas poultry Water Quality Management Plans (WQMPs), nutrient-management records, organic waste generation, storage, on-farm use, and transfer to responsible third parties

> This specification is a software and recordkeeping design, not a legal opinion. Each certified WQMP is site-specific and may impose requirements beyond the common requirements summarized here. Before production rollout, the fields and reports should be reviewed against the current certified plan for each farm and, preferably, with the farm's Soil and Water Conservation District or TSSWCB poultry-program contact.

---

## 1. Executive summary

FlockTrax should add a dedicated **BioWaste** module that traces poultry bedding and organic waste from its physical origin through storage, on-farm use, or transfer to another responsible person or entity.

The minimum defensible chain is:

`Farm + Barn + Placement/Flock -> Input material -> Waste batch -> Lab analysis -> Storage/Disposition event -> Recipient/Destination -> Receipt or supporting document`

The user's proposed tables are a sound starting point, but three structural changes are important:

1. A waste quantity must have both a numeric amount and a unit. Texas records use tons, cubic yards, or other appropriate units; a field named only `waste_volume` is not sufficient.
2. Storage, on-farm application, and third-party removal should be recorded as separate events rather than final columns on the waste batch. A single batch may be split among several recipients or destinations over several dates.
3. Laboratory samples and reports should be first-class records. A boolean and one file field cannot adequately represent annual testing, multiple samples, nutrient values, amendments, or proof that an analysis was supplied to a recipient.

For consistency and simpler compliance, FlockTrax should retain all BioWaste and WQMP records for **at least five years**, even where a narrower Texas statute specifies two years for a particular litter-transfer record.

---

## 2. Research findings

### 2.1 Applicability and plan status

- Texas requires commercial poultry facilities to develop, implement, and maintain a TSSWCB-certified WQMP covering the poultry operating unit before birds are placed at a new facility or additional poultry are placed at an existing facility.
- A WQMP is site-specific. The actual certified plan and its implementation schedule remain the controlling operational documents for a farm.
- Dry-litter poultry CAFOs that do not discharge and do not plan to discharge may operate without TCEQ water-quality permit coverage when they maintain the certified WQMP and satisfy the applicable CAFO rules. A discharge, loss of certification, or other circumstances can change the regulatory posture.
- A plan should be revised and recertified before material changes such as changes to land-management units, increased maximum bird capacity, new or modified poultry houses/storage/composting facilities, acreage or land-use changes, ownership changes, or other changes affecting discharge potential.

### 2.2 Core records identified by TSSWCB guidance

TSSWCB's dry-litter poultry guidance calls for records to be kept for at least five years and available during site inspections. The identified records include:

- The current certified WQMP, including its nutrient-management plan.
- Annual litter analyses, including years without a cleanout.
- Soil sample locations and annual analyses for land-management units expected to receive litter.
- On-farm litter/cake/manure use logs showing quantity, application date, location/field, acres, and weather conditions during application and for the 24 hours before and after application.
- Off-site transfer logs identifying the recipient's name and address, physical destination, removal date, and amount removed.
- Proof that the latest litter/nutrient analysis was made available to an off-site recipient or hauler.
- Mortality-management practices and evidence that the approved system is being used.
- Regular facility inspections, including monthly inspections of mortality systems, litter-application equipment, chemical storage, and disposal sites, plus an annual complete site inspection.
- Storage conditions, including whether litter is covered, protected from stormwater, and—if uncovered—whether it has remained stored for more than 30 days.
- Discharge incidents, notifications, sampling, laboratory tracking, and remedial actions when a discharge occurs.

### 2.3 Transfer records required by Texas statute

Texas Water Code Section 26.304 requires a poultry facility that sells or transfers poultry litter for off-site application to retain, until the second anniversary of the transfer:

- Identity of the purchaser or applicator.
- Physical destination identified by the purchaser or transferee.
- Date litter was removed from the poultry facility.
- Number of tons removed.

The recipient applying litter to land must retain a signed and dated proof-of-delivery document for each load and record the application date or dates. The proof-of-delivery requirement does not apply to certain non-land-application uses such as composting, biofuel, biogasification, or other beneficial use.

### 2.4 Nutrient-management and CAFO considerations

The Texas NRCS Nutrient Management standard (Practice Code 590) supports retaining:

- Soil, water, litter/manure, compost, organic by-product, and plant-tissue analyses used by the plan.
- Quantities, analyses, and sources of all nutrient imports, exports, and on-site transfers.
- Dates, methods, rates, sources, and locations of nutrient applications.
- Weather and soil-moisture conditions at application and elapsed time to rainfall or irrigation.
- Crops planted, harvest dates, actual yields, and nutrient analyses of harvested biomass when applicable.
- Plan-review date, reviewer, and recommended adjustments.
- Application-equipment calibration and documentation when actual application differs from the planned rate.

If a farm is covered by the TCEQ CAFO general permit, additional records may apply, including five-year on-site retention, weekly manure-use/removal records, annual nutrient and soil analyses, inspection records, spills, and annual reporting. The module should support those records without treating every farm as a permitted CAFO.

### 2.5 Mortality and carcass compost

Routine poultry mortality must be managed through an authorized method; routine on-site burial is prohibited. Because carcass compost is included in the requested waste types, the system should distinguish:

- Routine mortality from catastrophic mortality.
- Compost input, active compost, finished compost, and removal/use.
- Disposal method and receiving facility where carcasses leave the farm.
- TCEQ authorization or registration information where applicable.

---

## 3. Functional goals

The BioWaste module must:

1. Associate each material record with the correct farm, barn, flock, and preferably placement.
2. Record bedding or other organic inputs introduced into a barn.
3. Create traceable waste batches for manure cake, total cleanout litter, carcass compost, and other farm-generated organic material.
4. Preserve the full custody chain through storage, on-farm use, and third-party transfer.
5. Support partial disposition of a batch and multiple disposition events.
6. Store laboratory reports, delivery tickets, receipts, and WQMP documents in private Supabase Storage.
7. Reconcile generated quantity against quantity remaining, used, or transferred.
8. Provide farm-, flock-, barn-, date-, waste-type-, and recipient-level reports.
9. Alert users to missing documentation and upcoming or overdue compliance activities.
10. Preserve records and correction history for inspection and audit.

---

## 4. Navigation and screens

Add a new major sidebar group between **Placements** and **Configuration**:

### BioWaste

- **BioWaste Tracker** — `/admin/biowaste`
- **Responsible Entities** — `/admin/biowaste/entities`

Recommended later additions:

- **WQMP & Lab Records** — `/admin/biowaste/compliance`
- **Land Management Units** — `/admin/biowaste/land-management-units`
- **BioWaste Reports** — `/admin/biowaste/reports`

The user-facing label should be spelled **Responsible Entities**. Database naming should use `responsible_entity`, not a field or table name beginning with `3p`.

### 4.1 BioWaste Tracker minimum interface

The tracker should provide:

- Farm, barn, flock/placement, waste type, disposition status, entity, and date filters.
- A visible balance for each batch: generated, disposed/transferred, and remaining.
- Statuses such as `generated`, `stored`, `partially_disposed`, `fully_disposed`, `voided`.
- Quick actions for **Record Input**, **Generate Waste Batch**, **Record Storage**, **Record On-Farm Use**, **Transfer to Third Party**, **Attach Lab Report**, and **Correct Record**.
- Warnings for quantity imbalance, missing lab analysis, missing destination, missing recipient address, or missing proof of transfer.
- A farm/flock trace view showing the complete sequence from bedding input to final disposition.

### 4.2 Responsible Entities minimum interface

- Searchable list of recipients, purchasers, applicators, haulers, composters, renderers, landfills, and other responsible parties.
- Registration/authorization fields where relevant.
- Active/inactive state without deleting historical entities.
- Transfer history and total quantity received by period.
- Warning when required address or destination information is incomplete.

---

## 5. Proposed data model

### 5.1 Farm fields

Append the following requested columns to `public.farms`:

| Column | Type | Null | Purpose |
|---|---|---:|---|
| `wqmp_cert_id` | `text` | yes | Certified WQMP identifier exactly as issued. |
| `wqmp_last_audit_date` | `date` | yes | Most recent TSSWCB/SWCD review, audit, or inspection date recorded for the farm. |
| `wqmp_last_lab_date` | `date` | yes | Compatibility summary date requested by the business. Prefer maintaining it from lab records rather than manual entry. |

Recommended additional farm columns:

| Column | Type | Purpose |
|---|---|---|
| `wqmp_status` | `text` | `not_recorded`, `active`, `revision_pending`, `expired_or_withdrawn`, `not_applicable`. |
| `wqmp_certified_at` | `date` | Certification/recertification date. |
| `wqmp_next_review_date` | `date` | Plan-specific review target, if supplied. |
| `wqmp_last_litter_lab_date` | `date` | Derived convenience date for the latest litter/manure analysis. |
| `wqmp_last_soil_lab_date` | `date` | Derived convenience date for the latest soil analysis. |
| `wqmp_is_cafo` | `boolean` | Whether the farm is classified as a CAFO. |
| `wqmp_cafo_permit_number` | `text` | TCEQ permit or authorization identifier, when applicable. |
| `wqmp_notes` | `text` | Limited administrative notes; operational records belong in normalized tables. |

`wqmp_last_lab_date` should not be the only lab indicator because soil, litter/manure, water, and discharge analyses have different schedules and purposes.

### 5.2 `biowaste_input_records`

Tracks bedding and other material added before or during production.

| Column | Type | Requirement/notes |
|---|---|---|
| `bio_input_id` | `uuid` | Primary key; default `gen_random_uuid()`. |
| `farm_group_id` | `uuid` | FK to `farm_groups`; populated from the selected farm and protected from scope drift. |
| `farm_id` | `uuid` | Required FK to `farms`. |
| `barn_id` | `uuid` | Required FK to `barns`. |
| `placement_id` | `uuid` | Recommended FK to `placements`; authoritative flock/barn assignment at the time. |
| `flock_id` | `uuid` | FK to `flocks`; retained as an explicit historical/reporting dimension. |
| `input_type` | `text` | `new_wood_shavings`, `new_other_bedding`, `reused_litter`, `compost_carbon`, `other`. |
| `quantity_amount` | `numeric(14,3)` | Required, nonnegative. |
| `quantity_unit` | `text` | `cubic_yard`, `wet_ton`, `dry_ton`, `pound`, `bale`, `load`, `other`. |
| `date_added` | `date` | Required. |
| `source` | `text` | Vendor, farm source, prior barn, or explanatory source. |
| `source_entity_id` | `uuid` | Optional FK to responsible entities when supplied by a known business/person. |
| `source_lot_or_ticket` | `text` | Optional vendor lot, delivery, or ticket number. |
| `comments` | `text` | Free-form remarks. |
| audit columns | various | `created_at`, `created_by`, `updated_at`, `updated_by`, `voided_at`, `voided_by`, `void_reason`. |

### 5.3 `biowaste_output_records`

Represents a generated waste batch. It should not hold a single final recipient or final disposition because a batch can be divided.

| Column | Type | Requirement/notes |
|---|---|---|
| `bio_output_id` | `uuid` | Primary key. |
| `farm_group_id` | `uuid` | FK to `farm_groups`; derived from farm. |
| `farm_id` | `uuid` | Required FK to `farms`. |
| `barn_id` | `uuid` | Required FK to the origin barn. |
| `placement_id` | `uuid` | Recommended FK to placement for reliable origin traceability. |
| `flock_id` | `uuid` | Required origin flock where known. |
| `waste_type` | `text` | `manure_cake`, `manure_cleanout`, `carcass_compost`, `other`. |
| `other_waste_type` | `text` | Required when `waste_type = 'other'`. |
| `quantity_amount` | `numeric(14,3)` | Required generated quantity. |
| `quantity_unit` | `text` | At minimum `wet_ton`, `dry_ton`, `cubic_yard`, `gallon`, `pound`, `load`, `other`. |
| `weight_basis` | `text` | `wet`, `dry`, `not_applicable`, or `unknown`. |
| `moisture_percent` | `numeric(5,2)` | Optional; 0–100. |
| `date_generated` | `date` | Date the reference quantity became a waste batch. |
| `generation_method` | `text` | `cake_out`, `total_cleanout`, `mortality_compost`, `other`. |
| `initial_storage_location` | `text` | House, covered stack barn, composter, or other initial location. |
| `status` | `text` | `generated`, `stored`, `partially_disposed`, `fully_disposed`, `voided`. |
| `comments` | `text` | Remarks. |
| audit columns | various | Standard create/update/void metadata. |

Do not place `date_taken`, `dispo_type`, `bio_transfer_id`, or `third_party_usage_claim` on this table. Those belong to disposition events so one batch can have several legitimate outcomes.

### 5.4 `biowaste_disposition_records`

This is the custody and movement ledger for a waste batch.

| Column | Type | Requirement/notes |
|---|---|---|
| `bio_disposition_id` | `uuid` | Primary key. |
| `bio_output_id` | `uuid` | Required FK to the source waste batch. |
| `event_type` | `text` | `stored`, `storage_removed`, `on_farm_land_application`, `third_party_transfer`, `composted_on_farm`, `rendered`, `landfill`, `biofuel`, `biogas`, `other_beneficial_use`, `other_disposal`. |
| `event_at` | `timestamptz` | Date/time of storage, application, removal, or handoff. |
| `quantity_amount` | `numeric(14,3)` | Required event quantity. |
| `quantity_unit` | `text` | Must be convertible to or consistent with the batch unit. |
| `responsible_entity_id` | `uuid` | Required for third-party handoff; nullable for on-farm events. |
| `hauler_entity_id` | `uuid` | Optional separate carrier/hauler. |
| `physical_destination_name` | `text` | Required for off-site transfer. |
| `destination_address1` | `text` | Snapshot of the declared destination at the time of transfer. |
| `destination_address2` | `text` | Optional. |
| `destination_city` | `text` | Destination snapshot. |
| `destination_state` | `text` | Destination snapshot. |
| `destination_zip` | `text` | Destination snapshot. |
| `destination_latitude` / `destination_longitude` | `numeric` | Optional location evidence. |
| `declared_usage` | `text` | Recipient's declared use of the material. |
| `analysis_provided` | `boolean` | Whether the most recent applicable nutrient analysis was supplied. |
| `analysis_provided_at` | `timestamptz` | When it was supplied. |
| `vehicle_or_trailer` | `text` | Optional carrier trace. |
| `ticket_or_receipt_number` | `text` | Delivery, scale, or receipt identifier. |
| `received_by_name` | `text` | Recipient acknowledgment. |
| `received_at` | `timestamptz` | Recipient acknowledgment date/time. |
| `comments` | `text` | Remarks. |
| audit columns | various | Standard create/update/void metadata. |

Business rules:

- The sum of non-voided dispositions cannot exceed the waste batch after unit conversion.
- A third-party transfer cannot save without recipient identity, physical destination, date, amount, and unit.
- Contact/address values must be copied into the event as immutable snapshots; later edits to an entity must not rewrite historical transfer evidence.
- “Stacked” is a storage state, not a final disposal method.
- Corrections should void/supersede an event rather than erase its audit trail.

### 5.5 `biowaste_responsible_entities`

Renames the proposed `bioWaste_transfer_to` table to describe all possible responsible parties.

| Column | Type | Requirement/notes |
|---|---|---|
| `responsible_entity_id` | `uuid` | Primary key. |
| `farm_group_id` | `uuid` | Owner/scope of the address-book record. |
| `entity_type` | `text` | `person`, `company`, `government`, `other`. |
| `company_name` | `text` | Required for a company. |
| `first_name` | `text` | Contact/person name. |
| `last_name` | `text` | Contact/person name. |
| `address1` | `text` | Mailing/business address. |
| `address2` | `text` | Optional. |
| `city` | `text` | Added; missing from the proposed fields. |
| `state` | `text` | Corrected from `functionalitystate`. |
| `zip` | `text` | Postal code. |
| `phone` | `text` | Phone. |
| `mobile` | `text` | Mobile phone. |
| `email` | `text` | Added for delivery of analysis documents and receipts. |
| `roles` | `text[]` | One or more of `recipient`, `purchaser`, `applicator`, `hauler`, `composter`, `renderer`, `landfill`, `lab`, `vendor`, `other`. |
| `is_registered_wqmp` | `boolean` | Corrected from `is_registered_wqmb`; nullable if unknown. |
| `wqmp_registration_number` | `text` | Corrected from `wqmb_reg_num`; only when applicable. |
| `other_authorization_number` | `text` | TCEQ or other registration/permit identifier. |
| `is_active` | `boolean` | Deactivate without removing history. |
| `comments` | `text` | Remarks. |
| audit columns | various | Standard create/update metadata. |

Registration should not be presumed mandatory for every recipient. The transfer record should capture what role the entity actually assumes and the declared physical destination/use.

### 5.6 `biowaste_lab_samples`

| Column | Type | Requirement/notes |
|---|---|---|
| `lab_sample_id` | `uuid` | Primary key. |
| `farm_id` | `uuid` | Required FK. |
| `bio_output_id` | `uuid` | Optional waste-batch FK. |
| `land_management_unit_id` | `uuid` | Optional soil-sampling location FK. |
| `sample_type` | `text` | `litter`, `manure`, `carcass_compost`, `soil`, `water`, `discharge`, `other`. |
| `sample_collected_at` | `date` | Collection date. |
| `sample_sent_at` | `date` | Date sent to lab. |
| `results_received_at` | `date` | Date results received. |
| `lab_entity_id` | `uuid` | Optional FK to responsible entity with `lab` role. |
| `lab_tracking_number` | `text` | Laboratory sample/tracking number. |
| `sampling_location` | `text` | House, field/LMU, depth, or other location. |
| `sampling_depth` | `text` | Important for soil samples when plan-specific depths apply. |
| `total_nitrogen` | `numeric` | Result and basis/unit must be defined. |
| `total_phosphorus` | `numeric` | Result and basis/unit must be defined. |
| `total_potassium` | `numeric` | Result and basis/unit must be defined. |
| `moisture_percent` | `numeric(5,2)` | Result where applicable. |
| `result_data` | `jsonb` | Extensible values without losing the original report. |
| `document_id` | `uuid` | Link to private archived lab report. |
| `is_current_for_purpose` | `boolean` | Convenience marker; history remains immutable. |
| `comments` | `text` | Remarks. |
| audit columns | various | Standard metadata. |

The proposed `lab_sample_sent` boolean becomes derivable from `sample_sent_at`; `lab_document` becomes a protected document reference.

### 5.7 `wqmp_land_management_units`

Needed for defensible on-farm application records.

| Column | Type | Purpose |
|---|---|---|
| `land_management_unit_id` | `uuid` | Primary key. |
| `farm_id` | `uuid` | Required farm. |
| `unit_code` | `text` | Field/LMU identifier matching the WQMP map. |
| `name` | `text` | Friendly name. |
| `acreage` | `numeric(12,3)` | Current area. |
| `is_active` | `boolean` | Historical units remain available. |
| `geometry` | `geometry` or `jsonb` | Optional future field boundary. |
| `buffer_notes` | `text` | Plan-specific wells, waterways, and setbacks. |
| audit columns | various | Standard metadata. |

### 5.8 `biowaste_land_application_records`

One-to-one extension of a disposition event whose type is `on_farm_land_application`.

| Column | Type | Purpose |
|---|---|---|
| `bio_disposition_id` | `uuid` | PK/FK to disposition. |
| `land_management_unit_id` | `uuid` | Applied field/LMU. |
| `acres_applied` | `numeric(12,3)` | Acres covered. |
| `application_rate` | `numeric(14,3)` | Actual rate. |
| `application_rate_unit` | `text` | For example `wet_ton_per_acre` or `dry_ton_per_acre`. |
| `application_method` | `text` | Spreader/injection/other method. |
| `planned_rate` | `numeric(14,3)` | NMP planned rate. |
| `rate_variance_reason` | `text` | Required if actual differs from planned. |
| `weather_during` | `text` | Weather during application. |
| `weather_24h_before` | `text` | Required WQMP log value. |
| `weather_24h_after` | `text` | Required WQMP log value. |
| `soil_moisture` | `text` | NRCS 590 consideration. |
| `next_rainfall_or_irrigation_at` | `timestamptz` | Elapsed time evidence where known. |
| `crop` | `text` | Crop/pasture receiving nutrients. |
| `crop_acres` | `numeric(12,3)` | Crop acreage. |
| `annual_yield` | `numeric` | Optional annual reporting/NMP field. |
| `equipment_calibration_date` | `date` | Latest relevant calibration. |

### 5.9 `wqmp_compliance_events`

Recommended for plan reviews, inspections, incidents, and recertification rather than relying only on three farm summary dates.

Suggested event types:

- `plan_certified`
- `plan_recertified`
- `plan_reviewed`
- `tsswcb_or_swcd_inspection`
- `monthly_site_inspection`
- `annual_site_inspection`
- `storage_inspection`
- `equipment_calibration`
- `spill_or_discharge`
- `corrective_action`
- `ownership_or_operational_change`

Each event should include farm, event date/time, reviewer/inspector, findings, corrective action and due date, completion status, linked documents, and audit fields.

### 5.10 Documents

Use the existing private Supabase document-storage pattern, but extend the metadata model for WQMP records. Required document roles should include:

- `wqmp_certified_plan`
- `wqmp_amendment`
- `litter_lab_report`
- `soil_lab_report`
- `water_or_discharge_lab_report`
- `transfer_ticket`
- `scale_ticket`
- `proof_of_delivery`
- `recipient_analysis_copy`
- `inspection_report`
- `mortality_authorization`
- `corrective_action_document`

Because a laboratory report may support several waste batches or disposition events, a document-link table is preferable to forcing every document to have exactly one parent.

---

## 6. Data integrity, audit, and security

### 6.1 Referential rules

- `barn_id` must belong to `farm_id`.
- `placement_id`, `flock_id`, `barn_id`, and `farm_id` must agree at record creation.
- The farm group should be derived from the farm, not freely entered by the user.
- Historical origin fields must not be rewritten when a flock later moves or becomes unassigned.
- Entity address snapshots on transfer records must remain unchanged when the address book changes.

### 6.2 Record lifecycle

- Do not hard-delete compliance records through the application.
- Use void/supersede fields and require a correction reason.
- Preserve creator, updater, and timestamps.
- Log create, change, void, document replacement, and transfer acknowledgment actions in `activity_log`.
- Closed or archived flocks remain selectable for historical BioWaste corrections by authorized users.

### 6.3 Retention

- Default retention: at least five years from record creation or event date, whichever is later.
- Do not automatically purge when the five-year period expires.
- Support a future legal/compliance hold.
- Keep original uploaded documents immutable; replacement creates a new version.

### 6.4 Row-level security

- Follow existing farm-group membership scope.
- Farm-scoped users may only view and edit their permitted farms.
- Only authorized administrative/compliance roles may void records, modify historical records, or manage WQMP certification metadata.
- Document downloads must use authenticated, short-lived signed URLs from a private bucket.

---

## 7. Validation and workflow rules

1. **Quantity and unit are mandatory.** Do not allow an amount without a unit.
2. **No over-disposition.** The converted sum of non-voided events cannot exceed the generated batch quantity.
3. **Partial disposition is supported.** A batch remains open until its balance reaches zero.
4. **Off-site transfer completeness.** Recipient, physical destination, removal date, amount, and unit are required.
5. **Analysis handoff.** A third-party transfer warns or blocks according to policy if the latest applicable analysis has not been recorded as supplied.
6. **On-farm use completeness.** LMU, acres, actual rate, application date, and the required weather windows are mandatory.
7. **Annual litter analysis.** Alert when the latest farm litter/manure sample is older than the plan-defined interval, ordinarily 12 months.
8. **Soil analysis.** Alert only for LMUs scheduled to receive litter, following the actual WQMP sampling schedule.
9. **Storage duration.** Alert when uncovered storage approaches or exceeds 30 days.
10. **Plan revision warning.** Flag material farm changes for compliance review; do not automatically declare the WQMP invalid.
11. **Archived flock access.** Compliance history remains editable through a controlled correction workflow after flock settlement/archive.
12. **Dates.** A disposition cannot precede batch generation unless an authorized correction explains the exception.

---

## 8. Reports and audit package

### 8.1 Minimum reports

- Waste generated by farm, barn, flock/placement, waste type, and period.
- Waste-batch balance and unclosed batches.
- Off-site transfer log with recipient identity, physical destination, date, quantity, and unit.
- Recipient history and annual quantities.
- On-farm land-application log by LMU with acres, rate, and weather.
- Annual laboratory status by farm and sample type.
- WQMP compliance calendar and overdue items.
- Mortality-compost history.

### 8.2 Farm inspection package

Provide one exportable package by farm and date range containing:

- Farm WQMP identifier and certification status.
- Current certified plan and amendments.
- Litter/manure and soil laboratory reports.
- Waste generated, stored, used on-farm, and transferred.
- Transfer tickets and recipient/destination details.
- Proof that analysis was provided.
- Land-application logs.
- Inspection, incident, and corrective-action records.
- Record revision/audit trail.

PDF and CSV export should be considered required for the first complete compliance release.

---

## 9. Migration and implementation sequence

### Phase 1 — Foundation

1. Add requested WQMP fields and recommended status/certification fields to `farms`.
2. Create responsible entities, inputs, waste batches, dispositions, and lab samples.
3. Add constraints, indexes, audit columns, and RLS policies.
4. Add document roles/linking support and private-storage policies.
5. Add the **BioWaste** sidebar group, BioWaste Tracker, and Responsible Entities pages.

### Phase 2 — Compliance workflow

1. Add land-management units and land-application records.
2. Add WQMP compliance events and reminders.
3. Add transfer receipts, analysis-delivery workflow, and quantity reconciliation.
4. Add farm inspection package and reports.

### Phase 3 — Advanced controls

1. Mobile field entry and photo/document capture.
2. Recipient acknowledgment or signed proof-of-delivery workflow.
3. Geospatial LMU boundaries and destination coordinates.
4. Automated annual reporting summaries for farms subject to CAFO reporting.
5. Import/backfill tools for existing paper logs.

Migration implementation must follow the rebased Supabase migration tree documented in `supabase/MIGRATIONS.md`. It should be additive and must not change historical flock, feed, placement, or closeout data.

---

## 10. Acceptance criteria for the first release

- The sidebar contains a **BioWaste** major heading beneath **Placements** and above **Configuration**.
- The heading includes **BioWaste Tracker** and **Responsible Entities**.
- A user can record bedding/material input for a farm, barn, and flock/placement.
- A user can generate a waste batch with type, amount, unit, origin, and date.
- A batch can be divided among multiple storage/use/transfer events without losing balance integrity.
- Third-party transfers capture recipient, physical destination, removal date, amount, unit, declared use, and analysis-delivery status.
- Lab reports and transfer documents are stored privately and can be reopened from the relevant records.
- Settled/archived flock records remain traceable and cannot be silently rewritten or deleted.
- Farm-group RLS is verified.
- Five-year audit/report exports can be produced by farm.
- The migration passes a linked dry run before hosted application and leaves the migration tree aligned.

---

## 11. Open decisions before implementation

1. **Farm operation type — decided:** All farms will be dry-litter operations.
2. **Representative WQMP and forms — pending:** Obtain one representative certified WQMP and its current litter-transfer/application forms to confirm farm-specific fields.
3. **Standard operating quantity — decided:** The operating quantity will generally be recorded as estimated cubic yards.
4. **Input documentation — decided:** Vendor invoices or other input documents are not required. Inputs will be recorded by reference only.
5. **Correction and void authority — decided:** Approvals and voids require a `farm_membership` with the `farm_manager` role or a higher-authority role for the applicable farm.
6. **Recipient acknowledgment and disposal receipt — decided:** An uploaded, signed disposal receipt is sufficient; a separate recipient portal or platform signature is not required initially. FlockTrax should issue the receipt, number it sequentially, and include the data required by the applicable WQMP regulations. A configurable `platform.setting` prefix must be prepended to the sequenced receipt identifier using the format `SmoFarm-WQMP-YR-####`, where `YR` is the two-digit year in which the receipt was issued and `####` is the sequential number.
7. **Meaning of `wqmp_last_audit_date` — decided:** This field will primarily record the date of the TSSWCB/SWCD annual inspection. Other inspection and review dates should remain available through the normalized compliance-event records.

---

## 12. Primary sources reviewed

1. [TSSWCB Poultry Water Quality Management Program](https://tsswcb.texas.gov/index.php/programs/water-quality-management-plan/poultry-water-quality-management-program)
2. [TSSWCB Supplemental Guidance to WQMPs for All Dry-Litter Poultry Operations](https://tsswcb.texas.gov/sites/default/files/2022-03/poultry-wqmp-supplemental-guidance-final.pdf)
3. [TSSWCB WQMP Program Reference Guide and Poultry Inspection Forms](https://www.tsswcb.texas.gov/sites/default/files/files/programs/agency-reports/WQMP%20Program%20Reference%20Guide.pdf)
4. [31 Texas Administrative Code Chapter 523 — Agricultural and Silvicultural Water Quality Management](https://www.tsswcb.texas.gov/sites/default/files/files/programs/water-quality-management-plan/WQMP_Rules_Chp_523_Effect_7-7-2013.pdf)
5. [Texas Water Code, including Sections 26.302–26.305](https://statutes.capitol.texas.gov/docs/WA/pdf/WA.26.pdf)
6. [TCEQ CAFO General Permit TXG920000 — recordkeeping, reporting, and notification requirements](https://www.tceq.texas.gov/downloads/agency/decisions/agendas/backup/2023/2023-1733-mis.pdf/@@download/file/2023-1733-mis.pdf)
7. [Texas NRCS Conservation Practice Standard 590 — Nutrient Management](https://efotg.sc.egov.usda.gov/api/CPSFile/30019/590_TX_CPS_Nutrient_Management_2021)
8. [TCEQ RG-326 — Handling and Disposal of Carcasses from Poultry Operations](https://www.tceq.texas.gov/downloads/permitting/waste-permits/publications/rg-326.pdf)

These sources establish a common baseline. Current agency rules, the farm's certified WQMP, and any TCEQ permit or local requirements should be checked again when the feature is implemented.
