import { PageHeader } from "@/components/page-header";
import { saveIntegratorProfileAction } from "@/app/admin/integrator/actions";
import { getIntegratorBundle } from "@/lib/integrator-data";

type IntegratorPageProps = {
  searchParams?: Promise<{
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default async function IntegratorPage({ searchParams }: IntegratorPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);
  const bundle = await getIntegratorBundle();
  const profileMap = new Map(bundle.profile.map((field) => [field.key, field]));

  return (
    <>
      <PageHeader
        eyebrow="Integrator"
        title="Maintain the single integrator profile that anchors this FlockTrax system."
        body="This screen stores the integrator’s company and operations contacts while also surfacing live rollups from the farm-group, farm, barn, placement, flock, and auth datasets already inside the system."
      />

      <section className="integrator-grid">
        <article className="card integrator-card integrator-card-wide">
          <div className="settings-card-header settings-card-header-split">
            <div>
              <p className="settings-card-title">Integrator Profile</p>
              <p className="access-card-subtitle">
                This profile is managed as a single company record for the current deployment. Farm groups and farms
                below it will inherit their business context from this integrator layer.
              </p>
            </div>
          </div>

          {error ? (
            <div className="integrator-feedback-row" data-tone="danger">
              <span className="status-pill" data-tone="danger">Error</span>
              <p className="integrator-feedback-copy">{decodeURIComponent(error)}</p>
            </div>
          ) : null}
          {notice ? (
            <div className="integrator-feedback-row" data-tone="good">
              <span className="status-pill" data-tone="good">Saved</span>
              <p className="integrator-feedback-copy">{decodeURIComponent(notice)}</p>
            </div>
          ) : null}

          <form action={saveIntegratorProfileAction} className="integrator-form">
            <input name="return_to" type="hidden" value="/admin/integrator" />

            <section className="integrator-section">
              <div className="integrator-section-head">
                <p className="integrator-section-title">Company Identity</p>
                <p className="integrator-section-copy">Store the single integrator company record that will anchor farms and farm groups.</p>
              </div>
              <div className="integrator-form-grid">
                {renderIntegratorField(profileMap, "company_name", "field field-wide")}
                {renderIntegratorField(profileMap, "company_code", "field")}
                {renderIntegratorField(profileMap, "main_email", "field")}
                {renderIntegratorField(profileMap, "main_phone", "field")}
                {renderIntegratorField(profileMap, "address_line_1", "field field-wide")}
                {renderIntegratorField(profileMap, "address_line_2", "field field-wide")}
                {renderIntegratorField(profileMap, "city", "field")}
                {renderIntegratorField(profileMap, "state", "field")}
                {renderIntegratorField(profileMap, "postal_code", "field")}
              </div>
            </section>

            <section className="integrator-section">
              <div className="integrator-section-head">
                <p className="integrator-section-title">Operations Contacts</p>
                <p className="integrator-section-copy">Pair each department contact with the direct phone used for that operation.</p>
              </div>
              <div className="integrator-contact-grid">
                {renderIntegratorContactRow(profileMap, "Live Operations", "live_operations_contact", "live_operations_phone")}
                {renderIntegratorContactRow(profileMap, "Hatchery", "hatchery_contact", "hatchery_phone")}
                {renderIntegratorContactRow(profileMap, "Processing Plant", "processing_plant_contact", "processing_plant_phone")}
                {renderIntegratorContactRow(profileMap, "Catch Crew", "catch_crew_contact", "catch_crew_phone")}
                {renderIntegratorContactRow(profileMap, "Live Haul", "live_haul_contact", "live_haul_phone")}
              </div>
            </section>

            <div className="integrator-help-box">
              <p>
                Use this profile for the single integrator company information that should sit above all farm groups in
                this deployment.
              </p>
              <p>
                Contact slots are intentionally practical: live operations, hatchery, processing plant, catch crew, and
                live haul.
              </p>
            </div>

            <div className="settings-action-row">
              <button className="button settings-action-button" type="submit">
                Save Integrator
              </button>
            </div>
          </form>
        </article>

        <article className="card integrator-card">
          <div className="settings-card-header">
            <p className="settings-card-title">System Rollups</p>
          </div>

          <div className="integrator-stats-grid">
            {bundle.stats.map((stat) => (
              <div className="integrator-stat-card" key={stat.label}>
                <p className="integrator-stat-label">{stat.label}</p>
                <p className="integrator-stat-value">{stat.value}</p>
                <p className="integrator-stat-note">{stat.note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function renderIntegratorField(
  profileMap: Map<string, Awaited<ReturnType<typeof getIntegratorBundle>>["profile"][number]>,
  key: string,
  className = "field",
) {
  const field = profileMap.get(key);
  if (!field) {
    return null;
  }

  return (
    <label className={className} key={field.key}>
      <span>{field.label}</span>
      <input defaultValue={field.value} name={`field__${field.key}`} />
      <input name={`id__${field.key}`} type="hidden" value={field.id ?? ""} />
    </label>
  );
}

function renderIntegratorContactRow(
  profileMap: Map<string, Awaited<ReturnType<typeof getIntegratorBundle>>["profile"][number]>,
  departmentLabel: string,
  contactKey: string,
  phoneKey: string,
) {
  const contactField = profileMap.get(contactKey);
  const phoneField = profileMap.get(phoneKey);

  if (!contactField || !phoneField) {
    return null;
  }

  return (
    <div className="integrator-contact-row" key={departmentLabel}>
      <p className="integrator-contact-dept">{departmentLabel}</p>
      <label className="field integrator-contact-field">
        <span>Contact Name</span>
        <input defaultValue={contactField.value} name={`field__${contactField.key}`} />
        <input name={`id__${contactField.key}`} type="hidden" value={contactField.id ?? ""} />
      </label>
      <label className="field integrator-contact-field">
        <span>Phone</span>
        <input defaultValue={phoneField.value} name={`field__${phoneField.key}`} />
        <input name={`id__${phoneField.key}`} type="hidden" value={phoneField.id ?? ""} />
      </label>
    </div>
  );
}
