import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CloseoutReportActions } from "@/app/admin/flock-closeout/closeout-report-actions";
import { LogWeightReportSection } from "@/components/log-weight-report";
import { PageHeader } from "@/components/page-header";
import { buildPlacementLogEditorAccess, getPlacementEditorActorAccess } from "@/lib/placement-editor-access";
import { getPlacementLogWeightReportBundle } from "@/lib/placement-log-weight-report";

type PlacementWeightReportPageProps = {
  params: Promise<{
    placementId: string;
  }>;
};

export async function generateMetadata({ params }: PlacementWeightReportPageProps): Promise<Metadata> {
  const { placementId } = await params;
  const bundle = await getPlacementLogWeightReportBundle(placementId);

  return {
    title: `${bundle?.placementCode ?? "Placement"} Log Weight Report | FlockTrax Admin`,
  };
}

export default async function PlacementWeightReportPage({ params }: PlacementWeightReportPageProps) {
  const { placementId } = await params;
  const bundle = await getPlacementLogWeightReportBundle(placementId);

  if (!bundle) {
    notFound();
  }

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

  return (
    <div className="closeout-report-page">
      <PageHeader
        eyebrow="Placement Log Weight Report"
        title={
          <>
            <span>{bundle.placementCode}</span>
            <br />
            <span>{`${bundle.farmName} | Barn ${bundle.barnCode}`}</span>
          </>
        }
        body="Print-ready `log_weight` table with breed-spec benchmark comparisons for each sample row."
        actions={
          <>
            <CloseoutReportActions />
            <Link className="button-secondary" href={`/admin/placements/${bundle.placementId}/logs`}>
              Return To Log Matrix
            </Link>
          </>
        }
      />

      <section className="panel card closeout-report-shell">
        <LogWeightReportSection
          bundle={bundle}
          description="Each active male and female weight sample is matched to the placement breed's active `stdbreedspec` target for the same age day."
          title="Log Weight Table And Breed-Spec Comparison"
        />
      </section>
    </div>
  );
}
