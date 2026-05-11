export type IssueEntityType = "barn" | "placement";

export type IssueOption = {
  value: string;
  label: string;
  entityType: IssueEntityType;
};

export type IssueTypeRecord = {
  code: string;
  label: string;
  entityType: IssueEntityType;
  isActive?: boolean;
  sortOrder?: number | null;
  severityDefault?: string | null;
  reportGroup?: string | null;
};

export const DEFAULT_ISSUE_OPTIONS: IssueOption[] = [
  { value: "maintenance", label: "Maintenance / Repair", entityType: "barn" },
  { value: "feedlines", label: "Feedlines", entityType: "barn" },
  { value: "nipple_lines", label: "Nipple Lines", entityType: "barn" },
  { value: "equipment", label: "Equipment", entityType: "barn" },
  { value: "water", label: "Water", entityType: "barn" },
  { value: "ventilation", label: "Ventilation", entityType: "barn" },
  { value: "bird_health", label: "Bird Health Alert", entityType: "placement" },
  { value: "performance", label: "Performance", entityType: "placement" },
  { value: "mortality_review", label: "Mortality Review", entityType: "placement" },
];

const ISSUE_LABEL_MAP = new Map(DEFAULT_ISSUE_OPTIONS.map((option) => [option.value, option.label]));
const ISSUE_ENTITY_MAP = new Map(DEFAULT_ISSUE_OPTIONS.map((option) => [option.value, option.entityType]));

export function getDefaultIssueTypes(): IssueTypeRecord[] {
  return DEFAULT_ISSUE_OPTIONS.map((option, index) => ({
    code: option.value,
    label: option.label,
    entityType: option.entityType,
    isActive: true,
    sortOrder: (index + 1) * 10,
  }));
}

export function getIssueLabel(issueType: string | null | undefined) {
  const normalized = (issueType ?? "").trim();
  return ISSUE_LABEL_MAP.get(normalized) ?? (normalized || "Issue");
}

export function getIssueEntityTypeForType(issueType: string | null | undefined): IssueEntityType | null {
  const normalized = (issueType ?? "").trim();
  return ISSUE_ENTITY_MAP.get(normalized) ?? null;
}
