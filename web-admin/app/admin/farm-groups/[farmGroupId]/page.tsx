import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getFarmGroupById } from "@/lib/admin-data";

type FarmGroupDetailPageProps = {
  params: Promise<{ farmGroupId: string }>;
};

export default async function FarmGroupDetailPage({ params }: FarmGroupDetailPageProps) {
  const { farmGroupId } = await params;
  const record = await getFarmGroupById(farmGroupId);

  if (!record) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Farm Group Detail"
        title={`${record.farmGroup.legalName} is the parent operating layer over multiple farms.`}
        body="This view should help admins manage the grower company, see the farms underneath it, and understand how placement activity rolls up at the company level."
      />

      <section className="grid-2">
        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Group Snapshot</p>
              <h2>Parent entity profile</h2>
            </div>
          </div>
          <dl className="detail-grid">
            <div className="detail-item">
              <dt>Display Name</dt>
              <dd>{record.farmGroup.groupName}</dd>
            </div>
            <div className="detail-item">
              <dt>Legal Name</dt>
              <dd>{record.farmGroup.legalName}</dd>
            </div>
            <div className="detail-item">
              <dt>Integrator</dt>
              <dd>{record.farmGroup.integrator}</dd>
            </div>
            <div className="detail-item">
              <dt>Primary Contact</dt>
              <dd>{record.farmGroup.primaryContact}</dd>
            </div>
            <div className="detail-item">
              <dt>Home Base</dt>
              <dd>{record.farmGroup.homeBase}</dd>
            </div>
            <div className="detail-item">
              <dt>Status</dt>
              <dd>{record.farmGroup.status}</dd>
            </div>
          </dl>
        </article>

        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Farms</p>
              <h2>Child farm locations</h2>
            </div>
          </div>
          <div className="stack">
            {record.farms.map((farm) => (
              <Link className="detail-item" href={`/admin/farms/${farm.id}`} key={farm.id}>
                <dt>{farm.farmName}</dt>
                <dd>
                  {farm.city}, {farm.state} · {farm.barnCount} barns · {farm.activePlacements} active placements
                </dd>
                <p className="meta-copy">Manager {farm.managerName}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
