import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
GOOGLE_SHEETS_EPOCH = date(1899, 12, 30)


def normalize_label(value: str) -> str:
    return " ".join((value or "").strip().upper().split())


def parse_target_date(value: str) -> date:
    raw = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y", "%a %m/%d/%y", "%a %m/%d/%Y", "%A %m/%d/%y", "%A %m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    try:
        serial = float(raw)
        return GOOGLE_SHEETS_EPOCH + timedelta(days=serial)
    except ValueError as exc:
        raise ValueError(f"Unsupported date format: {value}") from exc


def normalize_sheet_date(value: object) -> Optional[date]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        serial = float(raw)
        return GOOGLE_SHEETS_EPOCH + timedelta(days=serial)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y", "%a %m/%d/%y", "%a %m/%d/%Y", "%A %m/%d/%y", "%A %m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def col_index_to_letter(index: int) -> str:
    result = ""
    index += 1
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


@dataclass(frozen=True)
class CellTarget:
    tab_name: str
    header_row: int
    date_header_label: str
    dataset_label: str
    target_date: str


class SheetsClient:
    def __init__(self, key_path: Optional[str] = None):
        resolved_key_path = key_path or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not resolved_key_path or not os.path.exists(resolved_key_path):
            raise RuntimeError(
                "GOOGLE_APPLICATION_CREDENTIALS is not set or the file does not exist."
            )

        credentials = service_account.Credentials.from_service_account_file(
            resolved_key_path, scopes=SCOPES
        )
        self.service = build("sheets", "v4", credentials=credentials)

    def _values_get(self, spreadsheet_id: str, range_a1: str):
        return (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=range_a1, majorDimension="ROWS")
            .execute()
        )

    def _values_update(self, spreadsheet_id: str, range_a1: str, value: str):
        body = {"values": [[value]]}
        return (
            self.service.spreadsheets()
            .values()
            .update(
                spreadsheetId=spreadsheet_id,
                range=range_a1,
                valueInputOption="USER_ENTERED",
                body=body,
            )
            .execute()
        )

    def _values_clear(self, spreadsheet_id: str, range_a1: str):
        return (
            self.service.spreadsheets()
            .values()
            .clear(spreadsheetId=spreadsheet_id, range=range_a1, body={})
            .execute()
        )

    def _find_header_indexes(
        self,
        spreadsheet_id: str,
        tab_name: str,
        header_row: int,
        date_header_label: str,
        dataset_label: str,
    ) -> tuple[int, int]:
        range_a1 = f"'{tab_name}'!1:{header_row}"
        rows = self._values_get(spreadsheet_id, range_a1).get("values", [])
        if len(rows) < header_row:
            raise RuntimeError(
                f"Sheet '{tab_name}' only has {len(rows)} visible header rows; need {header_row}."
            )

        headers = rows[header_row - 1]
        normalized = [normalize_label(value) for value in headers]
        date_idx = next(
            (idx for idx, value in enumerate(normalized) if value == normalize_label(date_header_label)),
            None,
        )
        field_idx = next(
            (idx for idx, value in enumerate(normalized) if value == normalize_label(dataset_label)),
            None,
        )

        if date_idx is None:
            raise RuntimeError(
                f"Could not find date header '{date_header_label}' on row {header_row} in tab '{tab_name}'."
            )
        if field_idx is None:
            raise RuntimeError(
                f"Could not find dataset label '{dataset_label}' on row {header_row} in tab '{tab_name}'."
            )

        return date_idx, field_idx

    def _find_row_for_date(
        self,
        spreadsheet_id: str,
        tab_name: str,
        header_row: int,
        date_col_idx: int,
        target_date: str,
    ) -> Optional[int]:
        target = parse_target_date(target_date)
        col_letter = col_index_to_letter(date_col_idx)
        start_row = header_row + 1
        range_a1 = f"'{tab_name}'!{col_letter}{start_row}:{col_letter}"
        rows = self._values_get(spreadsheet_id, range_a1).get("values", [])

        for offset, row in enumerate(rows):
            if not row:
                continue
            parsed = normalize_sheet_date(row[0])
            if parsed == target:
                return start_row + offset
            if str(row[0]).strip() == target_date.strip():
                return start_row + offset

        return None

    def resolve_cell(self, spreadsheet_id: str, target: CellTarget) -> str:
        date_idx, field_idx = self._find_header_indexes(
            spreadsheet_id,
            target.tab_name,
            target.header_row,
            target.date_header_label,
            target.dataset_label,
        )
        row_num = self._find_row_for_date(
            spreadsheet_id,
            target.tab_name,
            target.header_row,
            date_idx,
            target.target_date,
        )
        if row_num is None:
            raise RuntimeError(
                f"Could not find date '{target.target_date}' in tab '{target.tab_name}'."
            )
        return f"'{target.tab_name}'!{col_index_to_letter(field_idx)}{row_num}"

    def get_cell(self, spreadsheet_id: str, target: CellTarget) -> Optional[str]:
        range_a1 = self.resolve_cell(spreadsheet_id, target)
        rows = self._values_get(spreadsheet_id, range_a1).get("values", [])
        if not rows or not rows[0]:
            return None
        return rows[0][0]

    def put_cell(self, spreadsheet_id: str, target: CellTarget, value: str):
        range_a1 = self.resolve_cell(spreadsheet_id, target)
        return self._values_update(spreadsheet_id, range_a1, value)

    def clear_cell(self, spreadsheet_id: str, target: CellTarget):
        range_a1 = self.resolve_cell(spreadsheet_id, target)
        return self._values_clear(spreadsheet_id, range_a1)
