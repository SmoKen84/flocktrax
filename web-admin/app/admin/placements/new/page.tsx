import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";

export default async function NewPlacementPage() {
  const data = await getAdminData();

  return (
    <>
      <PageHeader
        eyebrow="Placement Wizard"
        title="Create the worker-facing placement from flock, farm, barn, and cycle dates."
        body="This is the core admin bridge. Farm plus barn plus day ultimately maps to a single placement identity, but admins should create it with planning language first."
      />

      <section className="grid-2">
        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Draft a new placement</h2>
            </div>
          </div>
          <form className="form-grid">
            <div className="field">
              <label htmlFor="farmGroup">Farm Group</label>
              <select defaultValue="" id="farmGroup">
                <option value="" disabled>
                  Select farm group
                </option>
                {data.farmGroups.map((farmGroup) => (
                  <option key={farmGroup.id} value={farmGroup.id}>
                    {farmGroup.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="farm">Farm</label>
              <select defaultValue="" id="farm">
                <option value="" disabled>
                  Select farm
                </option>
                {data.farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="barn">Barn</label>
              <select defaultValue="" id="barn">
                <option value="" disabled>
                  Select barn
                </option>
                {Object.values(data.barnsByFarmId)
                  .flat()
                  .map((barn) => (
                    <option key={barn.id} value={barn.id}>
                      Barn {barn.barnCode}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="flock">Flock</label>
              <select defaultValue="" id="flock">
                <option value="" disabled>
                  Select flock
                </option>
                {data.flocks.map((flock) => (
                  <option key={flock.id} value={flock.id}>
                    Flock {flock.flockCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="startDate">Placement Start</label>
              <input id="startDate" type="date" />
            </div>
            <div className="field">
              <label htmlFor="endDate">Projected End</label>
              <input id="endDate" type="date" />
            </div>
            <div className="field">
              <label htmlFor="placementCode">Placement Code</label>
              <input id="placementCode" placeholder="123-W2" type="text" />
            </div>
            <div className="field field-wide">
              <label htmlFor="notes">Allocation Notes</label>
              <textarea
                id="notes"
                placeholder="Document any special barn instructions, supervisor notes, or cycle assumptions."
              />
            </div>
            <div className="field field-wide">
              <button className="button" type="button">
                Save Placement Draft
              </button>
            </div>
          </form>
        </article>

        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Review likely allocations</h2>
            </div>
          </div>
          <div className="helper-banner">
            In milestone 2 this panel should validate overlaps, check active date windows, and show whether a
            farm-plus-barn selection would collide with another placement.
          </div>
          <div className="stack" style={{ marginTop: 18 }}>
            {data.placementHints.map((hint) => (
              <div className="card" key={hint.placementCode}>
                <p className="table-title">
                  {hint.farmName} · Barn {hint.barnCode}
                </p>
                <p className="table-subtitle">
                  Draft code {hint.placementCode} from flock {hint.flockCode}
                </p>
                <p className="meta-copy">
                  Window {hint.startDate} to {hint.projectedEndDate}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
