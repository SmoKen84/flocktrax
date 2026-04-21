import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";

type SupabaseClientLike = {
  schema: (schema: string) => {
    from: (table: string) => {
      select: (columns: string) => any;
    };
  };
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

type GoogleSheetsEndpointConfig = {
  endpointId: string;
  spreadsheetId: string;
  headerRow: number;
  dateHeaderLabel: string;
  placementKey: string;
};

export type GoogleSheetsColumnMapRow = {
  sourceTable: string;
  sourceField: string;
  sourceVariant: string | null;
  sheetLabel: string;
  valueMode: string;
};

const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const GOOGLE_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEETS_EPOCH_UTC = Date.UTC(1899, 11, 30);

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function getGoogleSheetsSyncContext(
  supabase: SupabaseClientLike,
  placementId: string,
): Promise<GoogleSheetsEndpointConfig | null> {
  const { data: placementRows, error: placementError } = await supabase
    .from("placements")
    .select("id,farm_id,placement_key")
    .eq("id", placementId)
    .limit(1);

  if (placementError) throw new Error(placementError.message);

  const placement = placementRows?.[0];
  if (!placement?.farm_id || !placement?.placement_key) {
    return null;
  }

  const { data: adapterRows, error: adapterError } = await supabase
    .schema("platform")
    .from("sync_adapters")
    .select("id")
    .eq("adapter_key", "googleapis-sheets")
    .limit(1);

  if (adapterError) throw new Error(adapterError.message);

  const adapterId = adapterRows?.[0]?.id;
  if (!adapterId) {
    return null;
  }

  const { data: endpointRows, error: endpointError } = await supabase
    .schema("platform")
    .from("sync_endpoints")
    .select("id")
    .eq("adapter_id", adapterId)
    .eq("farm_id", placement.farm_id)
    .eq("is_enabled", true)
    .limit(1);

  if (endpointError) throw new Error(endpointError.message);

  const endpointId = endpointRows?.[0]?.id;
  if (!endpointId) {
    return null;
  }

  const { data: workbookRows, error: workbookError } = await supabase
    .schema("platform")
    .from("sync_googleapis_sheets")
    .select("spreadsheet_id,header_row,date_header_label")
    .eq("endpoint_id", endpointId)
    .limit(1);

  if (workbookError) throw new Error(workbookError.message);

  const workbook = workbookRows?.[0];
  if (!workbook?.spreadsheet_id) {
    return null;
  }

  return {
    endpointId,
    spreadsheetId: workbook.spreadsheet_id,
    headerRow: typeof workbook.header_row === "number" ? workbook.header_row : 6,
    dateHeaderLabel: typeof workbook.date_header_label === "string" && workbook.date_header_label.trim()
      ? workbook.date_header_label
      : "DATE",
    placementKey: placement.placement_key,
  };
}

export async function getEnabledGoogleSheetsColumnMap(
  supabase: SupabaseClientLike,
  endpointId: string,
  sourceTables: string[],
): Promise<GoogleSheetsColumnMapRow[]> {
  if (sourceTables.length === 0) return [];

  const inList = sourceTables.map((value) => `"${value}"`).join(",");
  const { data, error } = await supabase
    .schema("platform")
    .from("sync_googleapis_sheet_columns")
    .select("source_table,source_field,source_variant,sheet_label,value_mode,sort_order")
    .eq("endpoint_id", endpointId)
    .eq("map_state", "enabled")
    .in("source_table", sourceTables)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    sourceTable: String(row.source_table ?? ""),
    sourceField: String(row.source_field ?? ""),
    sourceVariant: typeof row.source_variant === "string" && row.source_variant.trim() ? row.source_variant : null,
    sheetLabel: String(row.sheet_label ?? ""),
    valueMode: String(row.value_mode ?? "direct"),
  }));
}

export async function getSheetRowByDate(
  spreadsheetId: string,
  tabName: string,
  headerRow: number,
  dateHeaderLabel: string,
  targetDate: string,
): Promise<Record<string, string | null> | null> {
  const escapedTabName = escapeSheetTabName(tabName);
  const headerRows = await fetchSheetValues(spreadsheetId, `'${escapedTabName}'!A1:AZ${headerRow}`);
  if (headerRows.length < headerRow) {
    throw new Error(`Sheet '${tabName}' does not have header row ${headerRow}.`);
  }

  const headers = headerRows[headerRow - 1] ?? [];
  const normalizedHeaders = headers.map((value) => normalizeLabel(value));
  const dateColumnIndex = normalizedHeaders.findIndex((value) => value === normalizeLabel(dateHeaderLabel));
  if (dateColumnIndex < 0) {
    throw new Error(`Could not find date header '${dateHeaderLabel}' in tab '${tabName}'.`);
  }

  const startRow = headerRow + 1;
  const dateColumnLetter = colIndexToLetter(dateColumnIndex);
  const dateRows = await fetchSheetValues(
    spreadsheetId,
    `'${escapedTabName}'!${dateColumnLetter}${startRow}:${dateColumnLetter}`,
  );
  const wantedDate = parseTargetDate(targetDate);
  const wantedVariants = buildDateVariants(wantedDate);

  let rowNumber: number | null = null;
  for (let offset = 0; offset < dateRows.length; offset += 1) {
    const row = dateRows[offset] ?? [];
    const value = row[0] ?? "";
    const parsed = normalizeSheetDate(value);
    if (parsed && parsed === wantedDate) {
      rowNumber = startRow + offset;
      break;
    }

    const normalizedRaw = String(value).trim().replace(/\s+/g, " ");
    if (wantedVariants.has(normalizedRaw)) {
      rowNumber = startRow + offset;
      break;
    }
  }

  if (rowNumber === null) {
    return null;
  }

  const rowValues = await fetchSheetValues(spreadsheetId, `'${escapedTabName}'!A${rowNumber}:AZ${rowNumber}`);
  const row = rowValues[0] ?? [];
  const mapped: Record<string, string | null> = {};

  headers.forEach((header, index) => {
    const key = normalizeLabel(header);
    if (!key) return;
    mapped[key] = row[index] !== undefined ? String(row[index]) : null;
  });

  return mapped;
}

function escapeSheetTabName(value: string) {
  return String(value ?? "").replace(/'/g, "''");
}

function normalizeLabel(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function parseTargetDate(value: string) {
  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const weekdaySlashMatch = raw.match(/^(?:[A-Za-z]{3,9}) (\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (weekdaySlashMatch) {
    const month = weekdaySlashMatch[1].padStart(2, "0");
    const day = weekdaySlashMatch[2].padStart(2, "0");
    const year = weekdaySlashMatch[3].length === 2 ? `20${weekdaySlashMatch[3]}` : weekdaySlashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) {
    const date = new Date(SHEETS_EPOCH_UTC + asNumber * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  throw new Error(`Unsupported date format: ${value}`);
}

function normalizeSheetDate(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  try {
    return parseTargetDate(String(value));
  } catch {
    return null;
  }
}

function buildDateVariants(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Set([isoDate]);
  }

  const asDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const month = String(asDate.getUTCMonth() + 1);
  const day = String(asDate.getUTCDate());
  const year4 = String(asDate.getUTCFullYear());
  const year2 = year4.slice(-2);
  const shortWeekday = asDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const longWeekday = asDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  return new Set([
    isoDate,
    `${month}/${day}/${year2}`,
    `${month}/${day}/${year4}`,
    `${shortWeekday} ${month}/${day}/${year2}`,
    `${shortWeekday} ${month}/${day}/${year4}`,
    `${longWeekday} ${month}/${day}/${year2}`,
    `${longWeekday} ${month}/${day}/${year4}`,
  ]);
}

function colIndexToLetter(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function fetchSheetValues(spreadsheetId: string, rangeA1: string): Promise<string[][]> {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `${GOOGLE_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeA1)}?majorDimension=ROWS`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatGoogleSheetsReadError(response.status, text, rangeA1));
  }

  const payload = await response.json();
  return Array.isArray(payload.values) ? payload.values : [];
}

function formatGoogleSheetsReadError(status: number, rawText: string, rangeA1: string) {
  const tabName = extractTabNameFromRange(rangeA1);
  const parsedMessage = extractGoogleErrorMessage(rawText);

  if (status === 400 && parsedMessage.includes("Unable to parse range") && tabName) {
    return `Google Sheets tab '${tabName}' was not found in the workbook. FlockTrax expected a worksheet named exactly '${tabName}'.`;
  }

  if (status === 403 && parsedMessage.includes("does not have permission")) {
    return "Google Sheets access was denied for this workbook. The configured service account does not have permission to open it.";
  }

  return `Google Sheets read failed (${status}): ${rawText}`;
}

function extractGoogleErrorMessage(rawText: string) {
  try {
    const parsed = JSON.parse(rawText);
    return String(parsed?.error?.message ?? rawText);
  } catch {
    return rawText;
  }
}

function extractTabNameFromRange(rangeA1: string) {
  const match = String(rangeA1).match(/^'((?:[^']|'')+)'!/);
  if (!match) {
    return null;
  }

  return match[1].replace(/''/g, "'");
}

async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > now) {
    return cachedAccessToken.token;
  }

  const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")?.trim();
  const privateKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")?.trim();

  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const jwt = await buildGoogleJwt(clientEmail, privateKey);

  const tokenResponse = await fetch(GOOGLE_TOKEN_AUDIENCE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Google token request failed (${tokenResponse.status}): ${text}`);
  }

  const tokenPayload = await tokenResponse.json();
  cachedAccessToken = {
    token: String(tokenPayload.access_token),
    expiresAt: now + Number(tokenPayload.expires_in ?? 3600) * 1000,
  };

  return cachedAccessToken.token;
}

async function buildGoogleJwt(clientEmail: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKeyPem, "RS256");

  return await new SignJWT({
    iss: clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_AUDIENCE,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}
