import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";

export default async function FlocksPage() {
  const data = await getAdminData();

  return (
    <>
      <PageHeader
        eyebrow="Flocks"
        title="Track flock cohorts, planned placements, and projected live haul windows."
        body="Flocks belong to the admin side because they are planning entities, not worker selections. Workers should consume the resulting placement, not the flock record."
        actions={<button className="button">Add Flock</button>}
      />

      <section className="panel table-card">
        <div className="section-header" style={{ padding: "24px 24px 0" }}>
          <div>
            <p className="eyebrow">Flock Register</p>
            <h2>Upcoming and active flock cycles</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flock</th>
                <th>Integrator</th>
                <th>Placed</th>
                <th>Est. First Catch</th>
                <th>Bird Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.flocks.map((flock) => (
                <tr key={flock.id}>
                  <td>
                    <Link href={`/admin/flocks/${flock.id}`}>
                      <p className="table-title">Flock {flock.flockCode}</p>
                      <p className="table-subtitle">Open detail and placement context</p>
                    </Link>
                  </td>
                  <td>{flock.integrator}</td>
                  <td>{flock.placedDate}</td>
                  <td>{flock.estimatedFirstCatch}</td>
                  <td>{(flock.femaleCount + flock.maleCount).toLocaleString()}</td>
                  <td>
                    <span
                      className="status-pill"
                      data-tone={flock.status === "active" ? "good" : flock.status === "scheduled" ? "warn" : "danger"}
                    >
                      {flock.status}
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
