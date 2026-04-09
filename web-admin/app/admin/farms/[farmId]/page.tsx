import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getFarmById } from "@/lib/admin-data";

type FarmDetailPageProps = {
  params: Promise<{ farmId: string }>;
};

export default async function FarmDetailPage({ params }: FarmDetailPageProps) {
  const { farmId } = await params;
  const record = await getFarmById(farmId);

  if (!record) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Farm Detail"
        title={`${record.farm.farmName} is where placement reality meets barn capacity.`}
        body="This view should help admins maintain farm metadata and understand exactly which barns are active, open soon, or ready for the next cycle."
      />

      <section className="grid-2">
        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Farm Snapshot</p>
              <h2>Location profile</h2>
            </div>
          </div>
          <dl className="detail-grid">
            <div className="detail-item">
              <dt>Farm Group</dt>
              <dd>
                <Link href={`/admin/farm-groups/${record.farm.farmGroupId}`}>{record.farm.farmGroupName}</Link>
              </dd>
            </div>
            <div className="detail-item">
              <dt>Manager</dt>
              <dd>{record.farm.managerName}</dd>
            </div>
            <div className="detail-item">
              <dt>City</dt>
              <dd>{record.farm.city}</dd>
            </div>
            <div className="detail-item">
              <dt>Status</dt>
              <dd>{record.farm.status}</dd>
            </div>
          </dl>
        </article>

        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Barns</p>
              <h2>Barn readiness</h2>
            </div>
          </div>
          <div className="stack">
            {record.barns.map((barn) => (
              <div className="detail-item" key={barn.id}>
                <dt>Barn {barn.barnCode}</dt>
                <dd>
                  Capacity {barn.capacity.toLocaleString()} ·{" "}
                  {barn.currentPlacementCode ? `Current ${barn.currentPlacementCode}` : "Open for assignment"}
                </dd>
                <p className="meta-copy">Next available {barn.nextAvailableDate}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
