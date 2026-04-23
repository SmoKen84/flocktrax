import { PageHeader } from "@/components/page-header";
import { getFeedTicketAdminBundle, type FeedTicketAdminFilters } from "@/lib/feed-ticket-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

import { FeedTicketConsole } from "./feed-ticket-console";

type FeedTicketsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedTicketsPage({ searchParams }: FeedTicketsPageProps) {
  const params = (await searchParams) ?? {};
  const filters: FeedTicketAdminFilters = {
    listMode: firstParam(params.listMode) === "drop" ? "drop" : "ticket",
    ticketNumber: firstParam(params.ticketNumber),
    flockCode: firstParam(params.flockCode),
    farm: firstParam(params.farm),
    barn: firstParam(params.barn),
    bin: firstParam(params.bin),
    sourceType: firstParam(params.sourceType),
    dateFrom: firstParam(params.dateFrom),
    dateTo: firstParam(params.dateTo),
    includeStarter: toBoolean(params.includeStarter),
    includeGrower: toBoolean(params.includeGrower),
  };
  const bundle = await getFeedTicketAdminBundle(filters);
  const screenText = await getPlatformScreenTextValues(["admin_feed_title", "admin_feed_desc"]);
  const heroTitle = screenText.get("admin_feed_title") || "Reconcile Feed Tickets";
  const heroBody =
    screenText.get("admin_feed_desc") ||
    "Allows access to feed deliveries accepted on the farms and allocated to multiple feed bins and flocks.";

  return (
    <>
      <PageHeader eyebrow="Console" title={heroTitle} body={heroBody} />
      <FeedTicketConsole bundle={bundle} />
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toBoolean(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "true" || raw === "on" || raw === "1";
}
