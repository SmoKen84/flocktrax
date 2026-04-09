import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";

export default async function FarmsPage() {
  const data = await getAdminData();

  return (
    <>
      <PageHeader
        eyebrow="Farms"
        title="Manage the farm locations that live under each operating farm group."
        body="Farm Groups are now the true parent entity. This screen is for the individual farm sites beneath that company layer, along with their barn load and current activity."
        actions={<button className="button">Add Farm</button>}
      />

      <section className="panel table-card">
        <div className="section-header" style={{ padding: "24px 24px 0" }}>
          <div>
            <p className="eyebrow">Farm Directory</p>
            <h2>All configured farm locations</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Farm</th>
                <th>Farm Group</th>
                <th>Location</th>
                <th>Barns</th>
                <th>Active Placements</th>
                <th>Manager</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.farms.map((farm) => (
                <tr key={farm.id}>
                  <td>
                    <Link href={`/admin/farms/${farm.id}`}>
                      <p className="table-title">{farm.farmName}</p>
                      <p className="table-subtitle">{farm.farmGroupName}</p>
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/farm-groups/${farm.farmGroupId}`}>{farm.farmGroupName}</Link>
                  </td>
                  <td>
                    {farm.city}, {farm.state}
                  </td>
                  <td>{farm.barnCount}</td>
                  <td>{farm.activePlacements}</td>
                  <td>{farm.managerName}</td>
                  <td>
                    <span
                      className="status-pill"
                      data-tone={farm.status === "active" ? "good" : farm.status === "seasonal" ? "warn" : "danger"}
                    >
                      {farm.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
