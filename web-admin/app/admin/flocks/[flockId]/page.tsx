import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getFlockById } from "@/lib/admin-data";

type FlockDetailPageProps = {
  params: Promise<{ flockId: string }>;
};

export default async function FlockDetailPage({ params }: FlockDetailPageProps) {
  const { flockId } = await params;
  const flock = await getFlockById(flockId);

  if (!flock) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Flock Detail"
        title={`Flock ${flock.flockCode} is the planning source for one or more placements.`}
        body="This is where admins will eventually maintain flock-specific planning data such as placed date, estimated first live haul, bird counts, and allocation intent."
      />

      <section className="panel card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Planning Profile</p>
            <h2>Flock data</h2>
          </div>
        </div>
        <dl className="detail-grid">
          <div className="detail-item">
            <dt>Integrator</dt>
            <dd>{flock.integrator}</dd>
          </div>
          <div className="detail-item">
            <dt>Placed Date</dt>
            <dd>{flock.placedDate}</dd>
          </div>
          <div className="detail-item">
            <dt>Est. First Catch</dt>
            <dd>{flock.estimatedFirstCatch}</dd>
          </div>
          <div className="detail-item">
            <dt>Status</dt>
            <dd>{flock.status}</dd>
          </div>
          <div className="detail-item">
            <dt>Female Count</dt>
            <dd>{flock.femaleCount.toLocaleString()}</dd>
          </div>
          <div className="detail-item">
            <dt>Male Count</dt>
            <dd>{flock.maleCount.toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
