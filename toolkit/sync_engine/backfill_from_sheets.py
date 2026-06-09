from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from sheets_client import SheetsClient, normalize_label, normalize_sheet_date
from worker import ColumnMapRow, SupabaseRestClient, build_supabase_client, fetch_enabled_column_map

DEFAULT_SINGLE_WEIGHT_LABELS = [
    "AVG WEIGHT",
    "ACTUAL WEIGHT",
    "WEIGHT",
    "AVG WT",
    "AVG",
]
DEFAULT_SINGLE_WEIGHT_COUNT_LABELS = [
    "SAMPLE",
    "SAMPLE COUNT",
    "COUNT WEIGHED",
    "CNT WEIGHED",
    "WEIGHED",
    "SAMPLE M",
]
DEFAULT_SINGLE_WEIGHT_NOTE_LABELS = [
    "WEIGHT NOTES",
    "NOTES",
]

DAILY_INTEGER_FIELDS = {"age_days"}
DAILY_NUMERIC_FIELDS = {
    "am_temp",
    "set_temp",
    "rel_humidity",
    "outside_temp_current",
    "outside_temp_low",
    "outside_temp_high",
    "water_meter_reading",
}
DAILY_BOOLEAN_FIELDS = {
    "maintenance_flag",
    "feedlines_flag",
    "nipple_lines_flag",
    "bird_health_alert",
    "is_oda_open",
}
MORTALITY_INTEGER_FIELDS = {
    "dead_female",
    "dead_male",
    "cull_female",
    "cull_male",
    "grade_litter",
    "grade_footpad",
    "grade_feathers",
    "grade_lame",
    "grade_pecking",
}
WEIGHT_INTEGER_FIELDS = {"age_days", "cnt_weighed"}
WEIGHT_NUMERIC_FIELDS = {"avg_weight", "stddev_weight", "procure"}
TEXT_TRUE_VALUES = {"true", "t", "yes", "y", "1", "x", "open", "checked"}
TEXT_FALSE_VALUES = {"false", "f", "no", "n", "0", "closed", "unchecked"}


@dataclass(frozen=True)
class PlacementContext:
    placement_id: str
    placement_key: str
    farm_id: str
    farm_name: str
    placed_date: Optional[str]
    actor_user_id: Optional[str]
    endpoint_id: str
    spreadsheet_id: str
    spreadsheet_name: Optional[str]
    header_row: int
    date_header_label: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill historical FlockTrax log history from Google Sheets for selected placements."
    )
    parser.add_argument(
        "--placements",
        required=True,
        help="Comma-separated placement keys, for example 311-W5,312-W2",
    )
    parser.add_argument(
        "--mode",
        choices=["fill_missing_or_blank", "sheet_authoritative"],
        default="fill_missing_or_blank",
        help="Whether to fill only missing fields or let sheet values overwrite populated FlockTrax fields.",
    )
    parser.add_argument(
        "--datasets",
        default="daily,mortality,weight",
        help="Comma-separated dataset list: daily,mortality,weight",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write to FlockTrax. Without this flag, the run is dry-run only.",
    )
    parser.add_argument(
        "--max-column",
        default="AZ",
        help="Maximum Google Sheets column letter to read when scanning a tab. Default: AZ",
    )
    parser.add_argument(
        "--weight-single-labels",
        default=",".join(DEFAULT_SINGLE_WEIGHT_LABELS),
        help="Comma-separated fallback labels for one non-sex-specific actual weight column.",
    )
    parser.add_argument(
        "--weight-single-count-labels",
        default=",".join(DEFAULT_SINGLE_WEIGHT_COUNT_LABELS),
        help="Comma-separated fallback labels for one non-sex-specific weight sample-count column.",
    )
    parser.add_argument(
        "--weight-single-note-labels",
        default=",".join(DEFAULT_SINGLE_WEIGHT_NOTE_LABELS),
        help="Comma-separated fallback labels for one non-sex-specific weight note column.",
    )
    parser.add_argument(
        "--write-placement-note",
        action="store_true",
        help="Write one activity_log note per placement after a successful apply run.",
    )
    return parser.parse_args()


def csv_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_int(value: Any) -> Optional[int]:
    text = normalize_text(value)
    if text is None:
        return None
    try:
        return int(float(text.replace(",", "")))
    except ValueError:
        return None


def parse_float_value(value: Any) -> Optional[float]:
    text = normalize_text(value)
    if text is None:
        return None
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return None


def parse_bool(value: Any) -> Optional[bool]:
    text = normalize_text(value)
    if text is None:
        return None
    normalized = text.lower()
    if normalized in TEXT_TRUE_VALUES:
        return True
    if normalized in TEXT_FALSE_VALUES:
        return False
    return None


def looks_like_weight_text(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return False
    if any(token in normalized for token in [" lb", "lbs", "weight", "male", "males", "female", "females", "roo", "roos", "hen", "hens"]):
        return True
    compact = normalized.replace(".", "", 1)
    return compact.isdigit()


def extract_weight_from_text(value: Any) -> Optional[float]:
    text = normalize_text(value)
    if text is None:
        return None

    lowered = text.lower()
    import re

    male_match = re.search(r"(?:male|males|roo|roos)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)", lowered)
    if male_match:
        return parse_float_value(male_match.group(1))

    number_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(?:lb|lbs)?", lowered)
    if number_match:
        return parse_float_value(number_match.group(1))

    return None


def parse_by_field(field_name: str, value: Any, *, dataset: str) -> Any:
    if dataset == "daily":
        if field_name in DAILY_INTEGER_FIELDS:
            return parse_int(value)
        if field_name in DAILY_NUMERIC_FIELDS:
            return parse_float_value(value)
        if field_name in DAILY_BOOLEAN_FIELDS:
            return parse_bool(value)
        return normalize_text(value)

    if dataset == "mortality":
        if field_name in MORTALITY_INTEGER_FIELDS:
            return parse_int(value)
        return normalize_text(value)

    if dataset == "weight":
        if field_name in WEIGHT_INTEGER_FIELDS:
            return parse_int(value)
        if field_name in WEIGHT_NUMERIC_FIELDS:
            return parse_float_value(value)
        return normalize_text(value)

    return normalize_text(value)


def has_meaningful_payload(payload: dict[str, Any]) -> bool:
    return any(value is not None for value in payload.values())


def filter_fillable_payload(existing_row: Optional[dict[str, Any]], imported_payload: dict[str, Any], mode: str) -> dict[str, Any]:
    if existing_row is None or mode == "sheet_authoritative":
        return {key: value for key, value in imported_payload.items() if value is not None}

    filtered: dict[str, Any] = {}
    for key, value in imported_payload.items():
        if value is None:
            continue
        if is_blank(existing_row.get(key)):
            filtered[key] = value
    return filtered


def first_present(row_map: dict[str, Any], labels: list[str]) -> Any:
    for label in labels:
        normalized = normalize_label(label)
        if normalized in row_map and not is_blank(row_map[normalized]):
            return row_map[normalized]
    return None


def build_daily_payload(row_map: dict[str, Any], map_rows: list[ColumnMapRow]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for map_row in map_rows:
        raw_value = row_map.get(normalize_label(map_row.sheet_label))
        parsed = parse_by_field(map_row.source_field, raw_value, dataset="daily")
        if parsed is not None:
            payload[map_row.source_field] = parsed
    return payload


def build_mortality_payload(row_map: dict[str, Any], map_rows: list[ColumnMapRow]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for map_row in map_rows:
        raw_value = row_map.get(normalize_label(map_row.sheet_label))
        parsed = parse_by_field(map_row.source_field, raw_value, dataset="mortality")
        if parsed is not None:
            payload[map_row.source_field] = parsed
    return payload


def build_weight_payloads(
    row_map: dict[str, Any],
    map_rows: list[ColumnMapRow],
    *,
    single_weight_labels: list[str],
    single_count_labels: list[str],
    single_note_labels: list[str],
) -> dict[str, dict[str, Any]]:
    male_payload: dict[str, Any] = {}
    female_payload: dict[str, Any] = {}

    for map_row in map_rows:
        raw_value = row_map.get(normalize_label(map_row.sheet_label))
        parsed = parse_by_field(map_row.source_field, raw_value, dataset="weight")
        if parsed is None:
            continue

        variant = (map_row.source_variant or "").strip().lower()
        if variant == "female":
            female_payload[map_row.source_field] = parsed
        else:
            male_payload[map_row.source_field] = parsed

    if "avg_weight" not in male_payload:
        fallback_weight = parse_float_value(first_present(row_map, single_weight_labels))
        if fallback_weight is not None:
            male_payload["avg_weight"] = fallback_weight

    if "avg_weight" not in male_payload:
        extracted_weight = extract_weight_from_text(first_present(row_map, single_note_labels))
        if extracted_weight is not None:
            male_payload["avg_weight"] = extracted_weight

    if "cnt_weighed" not in male_payload:
        fallback_count = parse_int(first_present(row_map, single_count_labels))
        if fallback_count is not None:
            male_payload["cnt_weighed"] = fallback_count

    if "other_note" not in male_payload:
        fallback_note = normalize_text(first_present(row_map, single_note_labels))
        if fallback_note is not None and looks_like_weight_text(fallback_note):
            male_payload["other_note"] = fallback_note

    payloads: dict[str, dict[str, Any]] = {}
    if has_meaningful_payload(male_payload) and ("avg_weight" in male_payload or "cnt_weighed" in male_payload):
        payloads["male"] = male_payload
    if has_meaningful_payload(female_payload):
        payloads["female"] = female_payload
    return payloads


def build_sheet_rows(
    sheets: SheetsClient,
    placement: PlacementContext,
    *,
    max_column: str,
) -> list[tuple[str, dict[str, Any]]]:
    matrix = sheets.get_tab_matrix(placement.spreadsheet_id, placement.placement_key, max_column=max_column)
    if len(matrix) < placement.header_row:
        raise RuntimeError(
            f"Tab '{placement.placement_key}' in workbook '{placement.spreadsheet_name or placement.spreadsheet_id}' does not have header row {placement.header_row}."
        )

    header_values = matrix[placement.header_row - 1]
    headers = [normalize_label(value) for value in header_values]
    date_header = normalize_label(placement.date_header_label)
    if date_header not in headers:
        raise RuntimeError(f"Could not find date header '{placement.date_header_label}' in tab '{placement.placement_key}'.")

    date_col_idx = headers.index(date_header)
    rows: list[tuple[str, dict[str, Any]]] = []
    for row in matrix[placement.header_row:]:
        if date_col_idx >= len(row):
            continue
        row_date = normalize_sheet_date(row[date_col_idx])
        if row_date is None:
            continue
        row_map: dict[str, Any] = {}
        for idx, header in enumerate(headers):
            if not header:
                continue
            row_map[header] = row[idx] if idx < len(row) else None
        rows.append((row_date.isoformat(), row_map))

    return rows


def fetch_placement_context(client: SupabaseRestClient, placement_key: str) -> PlacementContext:
    placement_rows = client.select(
        "placements",
        columns="id,farm_id,flock_id,placement_key,created_by,updated_by",
        filters={"placement_key": f"eq.{placement_key}"},
        limit=1,
    )
    if not placement_rows:
        raise RuntimeError(f"Placement '{placement_key}' was not found.")
    placement = placement_rows[0]

    farm_rows = client.select(
        "farms_ui",
        columns="id,farm_name",
        filters={"id": f"eq.{placement['farm_id']}"},
        limit=1,
    )
    flock_rows = client.select(
        "flocks",
        columns="id,date_placed",
        filters={"id": f"eq.{placement['flock_id']}"},
        limit=1,
    )
    adapter_rows = client.select(
        "sync_adapters",
        schema="platform",
        columns="id",
        filters={"adapter_key": "eq.googleapis-sheets"},
        limit=1,
    )
    if not adapter_rows:
        raise RuntimeError("platform.sync_adapters has no googleapis-sheets adapter configured.")
    adapter_id = adapter_rows[0]["id"]

    endpoint_rows = client.select(
        "sync_endpoints",
        schema="platform",
        columns="id,endpoint_name,is_enabled",
        filters={
            "adapter_id": f"eq.{adapter_id}",
            "farm_id": f"eq.{placement['farm_id']}",
            "is_enabled": "eq.true",
        },
        limit=1,
    )
    if not endpoint_rows:
        raise RuntimeError(f"No enabled Google Sheets endpoint exists for placement '{placement_key}'.")
    endpoint = endpoint_rows[0]

    workbook_rows = client.select(
        "sync_googleapis_sheets",
        schema="platform",
        columns="spreadsheet_id,spreadsheet_name,header_row,date_header_label",
        filters={"endpoint_id": f"eq.{endpoint['id']}"},
        limit=1,
    )
    if not workbook_rows:
        raise RuntimeError(f"No workbook config exists for placement '{placement_key}'.")
    workbook = workbook_rows[0]

    return PlacementContext(
        placement_id=placement["id"],
        placement_key=placement["placement_key"],
        farm_id=placement["farm_id"],
        farm_name=farm_rows[0]["farm_name"] if farm_rows else "Unknown Farm",
        placed_date=flock_rows[0].get("date_placed") if flock_rows else None,
        actor_user_id=placement.get("created_by") or placement.get("updated_by"),
        endpoint_id=endpoint["id"],
        spreadsheet_id=workbook["spreadsheet_id"],
        spreadsheet_name=workbook.get("spreadsheet_name"),
        header_row=int(workbook.get("header_row") or 6),
        date_header_label=workbook.get("date_header_label") or "DATE",
    )


def fetch_existing_row(
    client: SupabaseRestClient,
    table_name: str,
    placement_id: str,
    log_date: str,
    *,
    sex: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    filters = {
        "placement_id": f"eq.{placement_id}",
        "log_date": f"eq.{log_date}",
    }
    if sex is not None:
        filters["sex"] = f"eq.{sex}"
    rows = client.select(table_name, columns="*", filters=filters, limit=1)
    return rows[0] if rows else None


def insert_row(client: SupabaseRestClient, table_name: str, row: dict[str, Any]) -> dict[str, Any]:
    response = client.session.post(
        f"{client.base_url}/rest/v1/{table_name}",
        headers={
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=row,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return data[0] if isinstance(data, list) else data


def update_row(client: SupabaseRestClient, table_name: str, row_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    response = client.session.patch(
        f"{client.base_url}/rest/v1/{table_name}",
        headers={
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        params={"id": f"eq.{row_id}"},
        json=patch,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return data[0] if isinstance(data, list) else data


def log_save_activity(
    client: SupabaseRestClient,
    *,
    placement_id: str,
    actor_user_id: Optional[str],
    action_key: str,
    details: str,
    source: str,
    meta: dict[str, Any],
) -> None:
    client.rpc(
        "write_activity_log",
        {
            "p_placement_id": placement_id,
            "p_entry_type": "functCall",
            "p_action_key": action_key,
            "p_details": details,
            "p_source": source,
            "p_actor_user_id": actor_user_id,
            "p_meta": meta,
        },
    )


def log_comment_activity(
    client: SupabaseRestClient,
    *,
    placement_id: str,
    actor_user_id: Optional[str],
    action_key: str,
    details: str,
    source: str,
    meta: dict[str, Any],
) -> None:
    if not normalize_text(details):
        return
    client.rpc(
        "write_activity_log",
        {
            "p_placement_id": placement_id,
            "p_entry_type": "comment",
            "p_action_key": action_key,
            "p_details": details,
            "p_source": source,
            "p_actor_user_id": actor_user_id,
            "p_meta": meta,
        },
    )


def save_daily(
    client: SupabaseRestClient,
    placement: PlacementContext,
    log_date: str,
    payload: dict[str, Any],
    existing_row: Optional[dict[str, Any]],
) -> dict[str, Any]:
    if existing_row:
        row = update_row(
            client,
            "log_daily",
            existing_row["id"],
            {**payload, "updated_by": placement.actor_user_id},
        )
        mode = "update"
    else:
        row = insert_row(
            client,
            "log_daily",
            {
                "placement_id": placement.placement_id,
                "log_date": log_date,
                "created_by": placement.actor_user_id,
                "is_active": True,
                **payload,
            },
        )
        mode = "insert"

    log_save_activity(
        client,
        placement_id=placement.placement_id,
        actor_user_id=placement.actor_user_id,
        action_key="save_log_daily_mobile",
        details=f"log_daily() saved for {log_date}",
        source="toolkit.sync_engine.backfill.daily",
        meta={"log_date": log_date, "record_id": row.get("id"), "mode": mode, "historical_backfill": True},
    )
    if normalize_text(row.get("comment")):
        log_comment_activity(
            client,
            placement_id=placement.placement_id,
            actor_user_id=placement.actor_user_id,
            action_key="log_daily.comment",
            details=str(row.get("comment")),
            source="toolkit.sync_engine.backfill.daily",
            meta={"log_date": log_date, "record_id": row.get("id"), "historical_backfill": True},
        )
    return row


def save_mortality(
    client: SupabaseRestClient,
    placement: PlacementContext,
    log_date: str,
    payload: dict[str, Any],
    existing_row: Optional[dict[str, Any]],
) -> dict[str, Any]:
    if existing_row:
        row = update_row(
            client,
            "log_mortality",
            existing_row["id"],
            {**payload, "updated_by": placement.actor_user_id},
        )
        mode = "update"
    else:
        row = insert_row(
            client,
            "log_mortality",
            {
                "placement_id": placement.placement_id,
                "log_date": log_date,
                "created_by": placement.actor_user_id,
                "is_active": True,
                **payload,
            },
        )
        mode = "insert"

    log_save_activity(
        client,
        placement_id=placement.placement_id,
        actor_user_id=placement.actor_user_id,
        action_key="save_log_mortality_mobile",
        details=f"log_mortality() saved for {log_date}",
        source="toolkit.sync_engine.backfill.mortality",
        meta={"log_date": log_date, "record_id": row.get("id"), "mode": mode, "historical_backfill": True},
    )

    note_parts = [
        f"Dead reason: {normalize_text(row.get('dead_reason'))}" if normalize_text(row.get("dead_reason")) else None,
        f"Cull females: {normalize_text(row.get('cull_female_note'))}" if normalize_text(row.get("cull_female_note")) else None,
        f"Cull males: {normalize_text(row.get('cull_male_note'))}" if normalize_text(row.get("cull_male_note")) else None,
    ]
    note_details = " | ".join(part for part in note_parts if part)
    if note_details:
        log_comment_activity(
            client,
            placement_id=placement.placement_id,
            actor_user_id=placement.actor_user_id,
            action_key="log_mortality.note",
            details=note_details,
            source="toolkit.sync_engine.backfill.mortality",
            meta={"log_date": log_date, "record_id": row.get("id"), "historical_backfill": True},
        )
    return row


def save_weight(
    client: SupabaseRestClient,
    placement: PlacementContext,
    log_date: str,
    sex: str,
    payload: dict[str, Any],
    existing_row: Optional[dict[str, Any]],
) -> dict[str, Any]:
    if existing_row:
        row = update_row(
            client,
            "log_weight",
            existing_row["id"],
            {**payload, "updated_by": placement.actor_user_id},
        )
        mode = "update"
    else:
        row = insert_row(
            client,
            "log_weight",
            {
                "placement_id": placement.placement_id,
                "log_date": log_date,
                "sex": sex,
                "created_by": placement.actor_user_id,
                "is_active": True,
                **payload,
            },
        )
        mode = "insert"

    log_save_activity(
        client,
        placement_id=placement.placement_id,
        actor_user_id=placement.actor_user_id,
        action_key="save_log_weight_mobile",
        details=f"log_weight() saved for {log_date} ({sex})",
        source="toolkit.sync_engine.backfill.weight",
        meta={"log_date": log_date, "record_id": row.get("id"), "mode": mode, "sex": sex, "historical_backfill": True},
    )
    if normalize_text(row.get("other_note")):
        log_comment_activity(
            client,
            placement_id=placement.placement_id,
            actor_user_id=placement.actor_user_id,
            action_key="log_weight.note",
            details=str(row.get("other_note")),
            source="toolkit.sync_engine.backfill.weight",
            meta={"log_date": log_date, "record_id": row.get("id"), "sex": sex, "historical_backfill": True},
        )
    return row


def write_placement_note(client: SupabaseRestClient, placement_id: str, details: str, meta: dict[str, Any]) -> None:
    client.rpc(
        "write_activity_log",
        {
            "p_placement_id": placement_id,
            "p_entry_type": "comment",
            "p_action_key": "historical_sheet_backfill",
            "p_details": details,
            "p_source": "toolkit.sync_engine.backfill_from_sheets",
            "p_meta": meta,
        },
    )


def main() -> int:
    args = parse_args()
    placement_keys = csv_list(args.placements)
    datasets = set(csv_list(args.datasets))
    single_weight_labels = csv_list(args.weight_single_labels)
    single_count_labels = csv_list(args.weight_single_count_labels)
    single_note_labels = csv_list(args.weight_single_note_labels)

    client = build_supabase_client()
    sheets = SheetsClient()

    summary: dict[str, Any] = {
        "mode": args.mode,
        "apply": args.apply,
        "placements": [],
    }

    for placement_key in placement_keys:
        placement = fetch_placement_context(client, placement_key)
        column_map_by_table = {
            "public.log_daily": fetch_enabled_column_map(client, placement.endpoint_id, "public.log_daily"),
            "public.log_mortality": fetch_enabled_column_map(client, placement.endpoint_id, "public.log_mortality"),
            "public.log_weight": fetch_enabled_column_map(client, placement.endpoint_id, "public.log_weight"),
        }

        sheet_rows = build_sheet_rows(sheets, placement, max_column=args.max_column)
        placement_summary: dict[str, Any] = {
            "placement_key": placement.placement_key,
            "farm_name": placement.farm_name,
            "spreadsheet_name": placement.spreadsheet_name,
            "sheet_rows_scanned": len(sheet_rows),
            "daily": {"created_or_updated": 0, "skipped": 0},
            "mortality": {"created_or_updated": 0, "skipped": 0},
            "weight": {"created_or_updated": 0, "skipped": 0},
            "changes": [],
        }

        placed_date = date.fromisoformat(placement.placed_date) if placement.placed_date else None

        for log_date, row_map in sheet_rows:
            if placed_date and date.fromisoformat(log_date) < placed_date:
                continue

            if "daily" in datasets:
                imported_daily = build_daily_payload(row_map, column_map_by_table["public.log_daily"])
                if has_meaningful_payload(imported_daily):
                    existing_daily = fetch_existing_row(client, "log_daily", placement.placement_id, log_date)
                    save_payload = filter_fillable_payload(existing_daily, imported_daily, args.mode)
                    if has_meaningful_payload(save_payload):
                        if args.apply:
                            save_daily(client, placement, log_date, save_payload, existing_daily)
                        placement_summary["daily"]["created_or_updated"] += 1
                        placement_summary["changes"].append({"dataset": "daily", "log_date": log_date, "payload": save_payload})
                    else:
                        placement_summary["daily"]["skipped"] += 1

            if "mortality" in datasets:
                imported_mortality = build_mortality_payload(row_map, column_map_by_table["public.log_mortality"])
                if has_meaningful_payload(imported_mortality):
                    existing_mortality = fetch_existing_row(client, "log_mortality", placement.placement_id, log_date)
                    save_payload = filter_fillable_payload(existing_mortality, imported_mortality, args.mode)
                    if has_meaningful_payload(save_payload):
                        if args.apply:
                            save_mortality(client, placement, log_date, save_payload, existing_mortality)
                        placement_summary["mortality"]["created_or_updated"] += 1
                        placement_summary["changes"].append({"dataset": "mortality", "log_date": log_date, "payload": save_payload})
                    else:
                        placement_summary["mortality"]["skipped"] += 1

            if "weight" in datasets:
                imported_weight_payloads = build_weight_payloads(
                    row_map,
                    column_map_by_table["public.log_weight"],
                    single_weight_labels=single_weight_labels,
                    single_count_labels=single_count_labels,
                    single_note_labels=single_note_labels,
                )
                for sex, imported_weight in imported_weight_payloads.items():
                    existing_weight = fetch_existing_row(client, "log_weight", placement.placement_id, log_date, sex=sex)
                    save_payload = filter_fillable_payload(existing_weight, imported_weight, args.mode)
                    if has_meaningful_payload(save_payload):
                        if args.apply:
                            save_weight(client, placement, log_date, sex, save_payload, existing_weight)
                        placement_summary["weight"]["created_or_updated"] += 1
                        placement_summary["changes"].append(
                            {"dataset": "weight", "log_date": log_date, "sex": sex, "payload": save_payload}
                        )
                    else:
                        placement_summary["weight"]["skipped"] += 1

        if args.apply and args.write_placement_note:
            write_placement_note(
                client,
                placement.placement_id,
                "Historical Google Sheets backfill imported into FlockTrax for audit support.",
                {
                    "mode": args.mode,
                    "tool": "toolkit.sync_engine.backfill_from_sheets",
                    "datasets": sorted(datasets),
                },
            )

        summary["placements"].append(placement_summary)

    print(json.dumps(summary, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
