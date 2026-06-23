import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlacementHatchTicketPanel } from "@/app/admin/placements/[placementId]/logs/placement-hatch-ticket-panel";
import { PlacementLogMatrixEditor } from "@/app/admin/placements/[placementId]/logs/placement-log-matrix-editor";
import { PageHeader } from "@/components/page-header";
import {
  getPlacementDocumentSummaryMap,
  HATCH_TICKET_DOCUMENT_ROLE,
} from "@/lib/document-archive";
import { getPlacementLogMatrixBundle } from "@/lib/placement-log-matrix";
import { buildPlacementLogEditorAccess, getPlacementEditorActorAccess } from "@/lib/placement-editor-access";

type PlacementLogsPageProps = {
  params: Promise<{
    placementId: string;
  }>;
};

export async function generateMetadata({ params }: PlacementLogsPageProps): Promise<Metadata> {
  const { placementId } = await params;
  const bundle = await getPlacementLogMatrixBundle(placementId);

  return {
    title: `${bundle?.placementCode ?? "Placement"} Log Matrix | FlockTrax Admin`,
  };
}

export default async function PlacementLogsPage({ params }: PlacementLogsPageProps) {
  const { placementId } = await params;
  const [bundle, hatchTicketSummaryMap] = await Promise.all([
    getPlacementLogMatrixBundle(placementId),
    getPlacementDocumentSummaryMap([placementId], HATCH_TICKET_DOCUMENT_ROLE),
  ]);

  if (!bundle) {
    notFound();
  }

  const hatchTicketSummary = hatchTicketSummaryMap.get(placementId) ?? null;

  const routeLockedMessage =
    bundle.closeoutStatus === "archived"
      ? "This placement has already been archived and is locked against further log-matrix corrections."
      : null;

  const actor = await getPlacementEditorActorAccess();
  const access = buildPlacementLogEditorAccess(actor, {
    placementId: bundle.placementId,
    tileState: "live",
    lifecycleStage: bundle.lifecycleStage,
    farmGroupId: bundle.farmGroupId ?? "",
    farmId: bundle.farmId,
  });

  if (!access.canView) {
    notFound();
  }

  if (!access.canOpen || routeLockedMessage) {
    return (
      <>
        <PageHeader
          eyebrow="Placement Log Matrix"
          title={bundle.placementCode}
          body={routeLockedMessage ?? access.message ?? "This placement log editor is not available."}
          actions={
            <Link className="button-secondary" href="/admin/overview">
              Return To Dashboard
            </Link>
          }
        />
        <section className="panel card placement-log-matrix-shell">
          <p>{routeLockedMessage ?? access.message ?? "This placement log editor is not available."}</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Placement Log Matrix"
        title={bundle.placementCode}
        body={`Matrix editor for ${bundle.farmName}, Barn ${bundle.barnCode}. Correct existing log dates or add missing dates within the placement range, then save the full recordset in one commit.`}
        actions={
          <>
            <Link
              className="button"
              href={`/admin/placements/${bundle.placementId}/logs/weight-report`}
              rel="noreferrer"
              target="_blank"
            >
              Log Weight Report
            </Link>
            {bundle.lifecycleStage === "waiting_closeout" || bundle.lifecycleStage === "closeout_submitted" ? (
              <Link className="button-secondary" href={`/admin/flock-closeout/${bundle.placementId}`}>
                Return To Closeout
              </Link>
            ) : null}
            <Link className="button-secondary" href="/admin/overview">
              Return To Dashboard
            </Link>
          </>
        }
      />

      <PlacementHatchTicketPanel
        placementCode={bundle.placementCode}
        placementId={bundle.placementId}
        summary={hatchTicketSummary}
      />

      <PlacementLogMatrixEditor bundle={bundle} />
    </>
  );
}
