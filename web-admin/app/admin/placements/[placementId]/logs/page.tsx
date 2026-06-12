import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlacementLogMatrixEditor } from "@/app/admin/placements/[placementId]/logs/placement-log-matrix-editor";
import { PageHeader } from "@/components/page-header";
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
  const bundle = await getPlacementLogMatrixBundle(placementId);

  if (!bundle) {
    notFound();
  }

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

      <PlacementLogMatrixEditor bundle={bundle} />
    </>
  );
}
