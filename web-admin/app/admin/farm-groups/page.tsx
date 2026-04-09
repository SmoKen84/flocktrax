import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";

export default async function FarmGroupsPage() {
  const data = await getAdminData();

  return (
    <>
      <PageHeader
        eyebrow="Farm Groups"
        title="Manage the operating companies that sit above individual farms."
        body="Farm groups are the parent layer for companies like Smotherman Farms Ltd. They organize the farms, barns, and placements that roll up under one grower operation."
        actions={<button className="button">Add Farm Group</button>}
      />

      <section className="panel table-card">
        <div className="section-header" style={{ padding: "24px 24px 0" }}>
          <div>
            <p className="eyebrow">Operating Companies</p>
            <h2>Parent entities above individual farms</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Farm Group</th>
                <th>Integrator</th>
                <th>Home Base</th>
                <th>Farms</th>
                <th>Active Placements</th>
                <th>Primary Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.farmGroups.map((farmGroup) => (
                <tr key={farmGroup.id}>
                  <td>
                    <Link href={`/admin/farm-groups/${farmGroup.id}`}>
                      <p className="table-title">{farmGroup.groupName}</p>
                      <p className="table-subtitle">{farmGroup.legalName}</p>
                    </Link>
                  </td>
                  <td>{farmGroup.integrator}</td>
                  <td>{farmGroup.homeBase}</td>
                  <td>{farmGroup.farmCount}</td>
                  <td>{farmGroup.activePlacements}</td>
                  <td>{farmGroup.primaryContact}</td>
                  <td>
                    <span
                      className="status-pill"
                      data-tone={
                        farmGroup.status === "active" ? "good" : farmGroup.status === "seasonal" ? "warn" : "danger"
                      }
                    >
                      {farmGroup.status}
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
