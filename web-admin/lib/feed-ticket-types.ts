export type FeedTicketTypeCode = "Reg" | "xTran" | "iTran" | "f2f";

export type FeedTicketTypeSetting = {
  value: string;
  desc: string;
};

export type FeedTicketTypeOption = {
  key: FeedTicketTypeCode;
  settingName: string;
  value: string;
  description: string;
};

const FEED_TICKET_TYPE_DEFS: Array<{
  key: FeedTicketTypeCode;
  settingName: string;
  fallbackValue: string;
  fallbackDescription: string;
}> = [
  {
    key: "Reg",
    settingName: "reg_feed_type",
    fallbackValue: "Reg",
    fallbackDescription: "Normal Feed Order",
  },
  {
    key: "xTran",
    settingName: "xtrans_feed_type",
    fallbackValue: "xTran",
    fallbackDescription: "OFF Farm Transfer",
  },
  {
    key: "iTran",
    settingName: "itrans_feed_type",
    fallbackValue: "iTran",
    fallbackDescription: "IN Farm Transfer",
  },
  {
    key: "f2f",
    settingName: "f2f_feed_type",
    fallbackValue: "f2f",
    fallbackDescription: "Flock-2-Flock Transfer",
  },
];

export function getFeedTicketTypeSettingNames() {
  return FEED_TICKET_TYPE_DEFS.map((entry) => entry.settingName);
}

export function buildFeedTicketTypeOptions(
  settings: Map<string, FeedTicketTypeSetting>,
): FeedTicketTypeOption[] {
  return FEED_TICKET_TYPE_DEFS.map((entry) => {
    const setting = settings.get(entry.settingName);
    return {
      key: entry.key,
      settingName: entry.settingName,
      value: setting?.value || entry.fallbackValue,
      description: setting?.desc || entry.fallbackDescription,
    };
  });
}

export function getFeedTicketTypeOptionByCode(
  code: string | null | undefined,
  settings: Map<string, FeedTicketTypeSetting>,
) {
  const normalized = String(code ?? "").trim();
  if (!normalized) {
    return null;
  }

  const def = FEED_TICKET_TYPE_DEFS.find((entry) => entry.key === normalized);
  if (!def) {
    return null;
  }

  const setting = settings.get(def.settingName);
  return {
    key: def.key,
    settingName: def.settingName,
    value: setting?.value || def.fallbackValue,
    description: setting?.desc || def.fallbackDescription,
  } satisfies FeedTicketTypeOption;
}

export function formatFeedTicketTypeOptionLabel(value: string, description: string) {
  const leftColumn = value.padEnd(8, " ");
  return description ? `${leftColumn}${description}` : value;
}

export function formatFeedTicketTypeHelp(option: { value: string; description: string } | null) {
  if (!option) return "";
  return option.description ? `${option.value} - ${option.description}` : option.value;
}
