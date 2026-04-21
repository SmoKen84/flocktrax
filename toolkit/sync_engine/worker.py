from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

import requests

from sheets_client import CellTarget, SheetsClient

SKIP_VALUE = object()


@dataclass(frozen=True)
class ClaimedJob:
    id: str
    endpoint_id: str
    entity_type: str
    entity_id: str
    operation: str
    placement_id: Optional[str]
    placement_key: Optional[str]
    log_date: Optional[str]
    payload: dict[str, Any]
    attempts: int
    requested_at: str
    spreadsheet_id: str
    spreadsheet_name: Optional[str]
    header_row: int
    date_header_label: str
    endpoint_name: str


@dataclass(frozen=True)
class ColumnMapRow:
    id: str
    source_table: str
    source_field: str
    source_variant: Optional[str]
    sheet_label: str
    value_mode: str
    map_state: str
    notes: Optional[str]


class SupabaseRestClient:
    def __init__(self) -> None:
        url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
            )

        self.base_url = url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
            }
        )

    def rpc(self, function_name: str, payload: dict[str, Any], *, schema: str = "public") -> Any:
        response = self.session.post(
            f"{self.base_url}/rest/v1/rpc/{function_name}",
            headers={
                "Content-Type": "application/json",
                "Accept-Profile": schema,
                "Content-Profile": schema,
            },
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        if not response.content:
            return None
        return response.json()

    def select(
        self,
        table_name: str,
        *,
        schema: str = "public",
        columns: str = "*",
        filters: Optional[dict[str, str]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"select": columns}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        response = self.session.get(
            f"{self.base_url}/rest/v1/{table_name}",
            headers={"Accept-Profile": schema},
            params=params,
            timeout=60,
        )
        response.raise_for_status()
        if not response.content:
            return []
        return response.json()


def build_supabase_client() -> SupabaseRestClient:
    return SupabaseRestClient()


def claim_jobs(client: SupabaseRestClient, limit: int) -> list[ClaimedJob]:
    rows = client.rpc("claim_googleapis_outbox", {"p_limit": limit}, schema="platform") or []
    jobs: list[ClaimedJob] = []
    for row in rows:
        jobs.append(
            ClaimedJob(
                id=row["id"],
                endpoint_id=row["endpoint_id"],
                entity_type=row["entity_type"],
                entity_id=row["entity_id"],
                operation=row["operation"],
                placement_id=row.get("placement_id"),
                placement_key=row.get("placement_key"),
                log_date=row.get("log_date"),
                payload=row.get("payload") or {},
                attempts=int(row.get("attempts") or 0),
                requested_at=row["requested_at"],
                spreadsheet_id=row["spreadsheet_id"],
                spreadsheet_name=row.get("spreadsheet_name"),
                header_row=int(row.get("header_row") or 6),
                date_header_label=row.get("date_header_label") or "DATE",
                endpoint_name=row.get("endpoint_name") or "Google Sheets",
            )
        )
    return jobs


def fetch_enabled_column_map(
    client: SupabaseRestClient, endpoint_id: str, source_table: str
) -> list[ColumnMapRow]:
    rows = client.select(
        "sync_googleapis_sheet_columns",
        schema="platform",
        columns="id,source_table,source_field,source_variant,sheet_label,value_mode,map_state,notes,sort_order",
        filters={
            "endpoint_id": f"eq.{endpoint_id}",
            "source_table": f"eq.{source_table}",
            "map_state": "eq.enabled",
        },
        order="sort_order.asc",
    )
    return [
        ColumnMapRow(
            id=row["id"],
            source_table=row["source_table"],
            source_field=row["source_field"],
            source_variant=(row.get("source_variant") or "").strip() or None,
            sheet_label=row["sheet_label"],
            value_mode=row["value_mode"],
            map_state=row.get("map_state") or "enabled",
            notes=row.get("notes"),
        )
        for row in rows
    ]


def fetch_source_record(
    client: SupabaseRestClient, entity_type: str, entity_id: str
) -> Optional[dict[str, Any]]:
    rows = client.select(
        entity_type,
        columns="*",
        filters={"id": f"eq.{entity_id}"},
        limit=1,
    )
    return rows[0] if rows else None


def format_value(value: Any, value_mode: str) -> Optional[str]:
    if value is None:
        return None

    if value_mode == "boolean_flag":
        return "X" if bool(value) else None

    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"

    if isinstance(value, Decimal):
        text = format(value, "f")
        return text.rstrip("0").rstrip(".") if "." in text else text

    if isinstance(value, float):
        text = f"{value:.10f}".rstrip("0").rstrip(".")
        return text or "0"

    if isinstance(value, int):
        return str(value)

    text = str(value).strip()
    return text or None


def resolve_mapped_value(source_record: dict[str, Any], map_row: ColumnMapRow) -> object:
    if map_row.source_variant:
        source_variant = str(source_record.get("sex") or "").strip().lower()
        if source_variant != map_row.source_variant.lower():
            return SKIP_VALUE

    raw_value = source_record.get(map_row.source_field)
    return format_value(raw_value, map_row.value_mode)


def complete_job(
    client: SupabaseRestClient,
    *,
    outbox_id: str,
    status: str,
    last_error: Optional[str],
    request_summary: dict[str, Any],
    response_summary: dict[str, Any],
    status_code: int,
) -> None:
    client.rpc(
        "complete_googleapis_outbox",
        {
            "p_outbox_id": outbox_id,
            "p_status": status,
            "p_last_error": last_error,
            "p_request_summary": request_summary,
            "p_response_summary": response_summary,
            "p_status_code": status_code,
        },
        schema="platform",
    )


def process_job(client: SupabaseRestClient, sheets: SheetsClient, job: ClaimedJob) -> str:
    source_table = f"public.{job.entity_type}"
    request_summary = {
        "entity_type": job.entity_type,
        "entity_id": job.entity_id,
        "operation": job.operation,
        "placement_key": job.placement_key,
        "log_date": job.log_date,
        "endpoint_id": job.endpoint_id,
        "endpoint_name": job.endpoint_name,
        "spreadsheet_id": job.spreadsheet_id,
        "spreadsheet_name": job.spreadsheet_name,
    }

    try:
        if not job.placement_key or not job.log_date:
            raise ValueError("Outbox row is missing placement_key or log_date.")

        map_rows = fetch_enabled_column_map(client, job.endpoint_id, source_table)
        if not map_rows:
            complete_job(
                client,
                outbox_id=job.id,
                status="rejected",
                last_error="No enabled column-map rows exist for this source table.",
                request_summary=request_summary,
                response_summary={"reason": "no_enabled_map_rows"},
                status_code=422,
            )
            return "rejected"

        source_record = fetch_source_record(client, job.entity_type, job.entity_id)
        if not source_record:
            complete_job(
                client,
                outbox_id=job.id,
                status="rejected",
                last_error="Source record no longer exists.",
                request_summary=request_summary,
                response_summary={"reason": "source_record_missing"},
                status_code=404,
            )
            return "rejected"

        writes: list[dict[str, Any]] = []
        clears: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []

        for map_row in map_rows:
            value = resolve_mapped_value(source_record, map_row)
            if value is SKIP_VALUE:
                skipped.append(
                    {
                        "sheet_label": map_row.sheet_label,
                        "source_field": map_row.source_field,
                        "reason": "variant_mismatch",
                    }
                )
                continue

            target = CellTarget(
                tab_name=job.placement_key,
                header_row=job.header_row,
                date_header_label=job.date_header_label,
                dataset_label=map_row.sheet_label,
                target_date=job.log_date,
            )

            if value is None:
                sheets.clear_cell(job.spreadsheet_id, target)
                clears.append({"sheet_label": map_row.sheet_label, "source_field": map_row.source_field})
                continue

            sheets.put_cell(job.spreadsheet_id, target, value)
            writes.append(
                {
                    "sheet_label": map_row.sheet_label,
                    "source_field": map_row.source_field,
                    "value": value,
                }
            )

        response_summary = {
            "worksheet": job.placement_key,
            "write_count": len(writes),
            "clear_count": len(clears),
            "skip_count": len(skipped),
            "writes": writes,
            "clears": clears,
            "skipped": skipped,
        }
        complete_job(
            client,
            outbox_id=job.id,
            status="sent",
            last_error=None,
            request_summary=request_summary,
            response_summary=response_summary,
            status_code=200,
        )
        return "sent"
    except Exception as exc:  # noqa: BLE001
        complete_job(
            client,
            outbox_id=job.id,
            status="failed",
            last_error=str(exc),
            request_summary=request_summary,
            response_summary={"exception": str(exc)},
            status_code=500,
        )
        return "failed"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Process pending Google Sheets sync outbox rows.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of outbox rows to claim.")
    args = parser.parse_args(argv)

    client = build_supabase_client()
    sheets = SheetsClient()
    jobs = claim_jobs(client, args.limit)

    if not jobs:
        print("No pending googleapis-sheets outbox rows found.")
        return 0

    counts = {"sent": 0, "failed": 0, "rejected": 0}
    for job in jobs:
        status = process_job(client, sheets, job)
        counts[status] = counts.get(status, 0) + 1
        print(f"{job.id} {job.entity_type} {job.log_date} -> {status}")

    print(json.dumps({"claimed": len(jobs), **counts}, indent=2))
    return 0 if counts["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
