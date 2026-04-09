import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { PageHeader } from "@/components/page-header";
import { applicationRegistry } from "@/lib/app-registry";

function getFeatureTone(status: "enabled" | "disabled" | "planned") {
  if (status === "enabled") {
    return "good";
  }

  if (status === "disabled") {
    return "danger";
  }

  return "warn";
}

export default function AppRegistryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Application Registry"
        title="Maintain the application record, ownership copy, and feature rollout tags."
        body="This page is the future home for app_owner-only controls once role-based access is wired into the admin console."
      />

      <section className="panel card registry-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Application Record</p>
            <h2>{applicationRegistry.title}</h2>
            <div className="registry-wordmark-pair">
              <FlockTraxWordmark compact product="Admin" />
              <FlockTraxWordmark compact product="Mobile" />
            </div>
          </div>
          <span className="status-pill" data-tone="good">
            ...
          </span>
        </div>

        <p className="body-copy">{applicationRegistry.summary}</p>
        <p className="registry-ownership">{applicationRegistry.ownershipStatement}</p>

        <details className="registry-details" open>
          <summary>Ownership, copyright, and support details</summary>
          <div className="registry-table-wrap">
            <table className="registry-table">
              <tbody>
                {applicationRegistry.fields.map((field) => (
                  <tr key={field.label}>
                    <th scope="row">{field.label}</th>
                    <td>{field.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="registry-details">
          <summary>Feature preferences and rollout tags</summary>
          <div className="registry-feature-list">
            {applicationRegistry.featurePreferences.map((feature) => (
              <article className="registry-feature-card" key={feature.key}>
                <div className="section-header" style={{ marginBottom: 8 }}>
                  <div>
                    <p className="table-title">{feature.label}</p>
                    <p className="table-subtitle">{feature.key}</p>
                  </div>
                  <span className="status-pill" data-tone={getFeatureTone(feature.status)}>
                    {feature.status}
                  </span>
                </div>
                <p className="meta-copy">{feature.note}</p>
              </article>
            ))}
          </div>
        </details>
      </section>
    </>
  );
}
