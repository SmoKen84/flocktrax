import Link from "next/link";

import {
  deleteDailyAgeTaskAction,
  saveDailyAgeTaskAction,
  updateScreenTextAction,
  updateAppSettingAction,
} from "@/app/admin/settings/actions";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getSettingsBundle } from "@/lib/settings-data";
import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";

type SettingsPageProps = {
  searchParams?: Promise<{
    group?: string | string[];
    setting?: string | string[];
    task?: string | string[];
    screen?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedGroupParam = readParam(params?.group);
  const selectedSettingParam = readParam(params?.setting);
  const selectedTaskParam = readParam(params?.task);
  const selectedScreenParam = readParam(params?.screen);
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);

  const [bundle, accessBundle] = await Promise.all([getSettingsBundle(), getUserAccessBundle()]);
  const actingUser = accessBundle.users.find((user) => user.id === accessBundle.actingUserId) ?? accessBundle.users[0] ?? null;
  const actingRole = actingUser ? resolveRoleTemplate(accessBundle.roles, actingUser.role) : null;
  const canEditScreenRegistry = canEditPlatformContent(actingRole);
  const selectedGroup =
    bundle.settingGroups.find((group) => group === selectedGroupParam) ??
    bundle.settingGroups[0] ??
    "";
  const visibleSettings = bundle.settings.filter((setting) => setting.group === selectedGroup);
  const selectedSetting =
    visibleSettings.find((setting) => setting.name === selectedSettingParam) ??
    visibleSettings[0] ??
    null;
  const selectedTask =
    bundle.reminderTasks.find((task) => task.id === selectedTaskParam) ??
    null;
  const selectedScreenText =
    bundle.screenTexts.find((screenText) => screenText.name === selectedScreenParam) ??
    bundle.screenTexts[0] ??
    null;

  const buildSettingsHref = (options: {
    group?: string | null;
    setting?: string | null;
    task?: string | null;
    screen?: string | null;
    anchor?: string | null;
  } = {}) => {
    const query = new URLSearchParams();
    const group = options.group === undefined ? selectedGroup : options.group;
    const setting = options.setting === undefined ? selectedSetting?.name ?? null : options.setting;
    const task = options.task === undefined ? selectedTask?.id ?? null : options.task;
    const screen = options.screen === undefined ? selectedScreenText?.name ?? null : options.screen;
    const anchor = options.anchor === undefined ? null : options.anchor;

    if (group) query.set("group", group);
    if (setting) query.set("setting", setting);
    if (task) query.set("task", task);
    if (screen) query.set("screen", screen);

    const search = query.toString();
    const base = search ? `/admin/settings?${search}` : "/admin/settings";
    return anchor ? `${base}#${anchor}` : base;
  };

  const returnTo = buildSettingsHref();

  return (
    <>
      <section className="panel settings-hero-panel">
        <p className="hero-kicker">Options &amp; Settings</p>
        <FlockTraxWordmark compact product="Admin" tone="accent" />
        <p className="access-hero-copy">
          Live platform options now read from the hosted settings tables. Changes from this screen save directly into
          the shared configuration catalog used by the current pre-release environment.
        </p>
      </section>

      <section className="settings-grid">
        <article className="card settings-card">
          <div className="settings-card-header">
            <p className="settings-card-title">FlockTrax Options</p>
          </div>

          {error ? <p className="login-banner login-banner-error">{decodeURIComponent(error)}</p> : null}
          {notice ? <p className="login-banner login-banner-notice">{decodeURIComponent(notice)}</p> : null}

          <form className="settings-group-row" method="get">
            <label className="settings-label" htmlFor="settings-group">
              Group
            </label>
            <select className="settings-select" defaultValue={selectedGroup} id="settings-group" name="group">
              {bundle.settingGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <button className="button-secondary settings-group-button" type="submit">
              Load Group
            </button>
          </form>

          <div className="settings-config-grid">
            <div className="settings-option-list">
              <div className="settings-column-head">
                <span>Option Name</span>
              </div>
              {visibleSettings.length > 0 ? (
                visibleSettings.map((setting) => (
                  <Link
                    className="settings-option-item"
                    data-active={setting.id === selectedSetting?.id}
                    href={buildSettingsHref({ setting: setting.name, task: selectedTask?.id ?? null })}
                    key={setting.id}
                  >
                    {setting.name}
                  </Link>
                ))
              ) : (
                <p className="settings-empty-state">No live settings were found for this group yet.</p>
              )}
            </div>

            <div className="settings-value-panel">
              <div className="settings-column-head">
                <span>Value</span>
              </div>
              {selectedSetting ? (
                <form action={updateAppSettingAction} className="settings-editor-form">
                  <input name="return_to" type="hidden" value={returnTo} />
                  <input name="setting_id" type="hidden" value={selectedSetting.id} />
                  <input name="setting_group" type="hidden" value={selectedSetting.group} />
                  <input name="setting_name" type="hidden" value={selectedSetting.name} />
                  <input className="settings-value-input" defaultValue={selectedSetting.value} name="value" />
                  <div className="settings-value-help">
                    <p>{selectedSetting.description || "No operator note has been saved for this setting yet."}</p>
                    <p>
                      Group: <strong>{selectedSetting.group}</strong>
                    </p>
                    <p>
                      Last updated: <strong>{selectedSetting.updatedAt ? formatTimestamp(selectedSetting.updatedAt) : "Not recorded"}</strong>
                    </p>
                  </div>

                  <div className="settings-action-row">
                    <Link className="button-secondary settings-action-button" href={buildSettingsHref({ setting: selectedSetting.name })}>
                      Reset
                    </Link>
                    <button className="button settings-action-button" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <p className="settings-empty-state">Select a live option to review and save its value.</p>
              )}
            </div>
          </div>
        </article>

        <article className="card settings-card">
          <div className="settings-card-header">
            <p className="settings-card-title">Reminder Task Lines</p>
          </div>

          <div className="settings-reminder-top">
            <div className="settings-reminder-copy">
              <p>
                Single line reminders display on the FlockTrax Mobile daily input screen to keep flock-age-specific
                tasks visible to the farm team.
              </p>
              <p>
                These reminder lines now read from the live `daily_age_tasks` table. Lower display order values appear
                higher in the mobile reminder stack.
              </p>
            </div>

            <form action={saveDailyAgeTaskAction} className="settings-reminder-editor">
              <input name="return_to" type="hidden" value={returnTo} />
              <input name="task_id" type="hidden" value={selectedTask?.id ?? ""} />

              <label className="settings-label" htmlFor="task-line">
                Task / Reminder Line
              </label>
              <input
                className="settings-value-input"
                defaultValue={selectedTask?.taskLabel ?? ""}
                id="task-line"
                name="task_label"
              />

              <div className="settings-reminder-meta">
                <div className="settings-reminder-box">
                  <span>First</span>
                  <input defaultValue={selectedTask?.minAgeDays ?? ""} name="min_age_days" />
                </div>
                <div className="settings-reminder-box">
                  <span>Last</span>
                  <input defaultValue={selectedTask?.maxAgeDays ?? ""} name="max_age_days" />
                </div>
                <div className="settings-reminder-box">
                  <span>Priority</span>
                  <input defaultValue={selectedTask?.displayOrder ?? 0} name="display_order" />
                </div>
              </div>

              <label className="settings-toggle">
                <input defaultChecked={selectedTask ? selectedTask.isActive : true} name="is_active" type="checkbox" />
                <span>Active task</span>
              </label>

              <div className="settings-action-row">
                <Link className="button-secondary settings-action-button" href={buildSettingsHref({ task: null })}>
                  Clear
                </Link>
                {selectedTask ? (
                  <button className="button-secondary settings-action-button" formAction={deleteDailyAgeTaskAction} type="submit">
                    Delete
                  </button>
                ) : null}
                <button className="button settings-action-button" type="submit">
                  {selectedTask ? "Save" : "Add Task"}
                </button>
              </div>
            </form>
          </div>

          <div className="settings-reminder-table">
            <div className="settings-reminder-table-head">
              <span>Task</span>
              <span>Active</span>
              <span>First</span>
              <span>Last</span>
              <span>Priority</span>
            </div>
            {bundle.reminderTasks.map((task) => (
              <Link
                className="settings-reminder-table-row"
                data-active={task.id === selectedTask?.id}
                href={buildSettingsHref({ task: task.id })}
                key={task.id}
              >
                <span>{task.taskLabel}</span>
                <span>{task.isActive ? "Yes" : "No"}</span>
                <span>{task.minAgeDays ?? "-"}</span>
                <span>{task.maxAgeDays ?? "-"}</span>
                <span>{task.displayOrder}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      {canEditScreenRegistry ? (
        <section className="settings-grid">
          <article className="card settings-card settings-card-wide" id="screen-text-registry">
            <div className="settings-card-header settings-card-header-split">
              <div>
                <p className="settings-card-title">Screen Text Registry</p>
                <p className="access-card-subtitle">
                  Managed platform copy lives in `platform.screen_txt`. This editor is intentionally keyed and constrained
                  so it behaves like a configuration registry rather than a user-facing CMS.
                </p>
              </div>
              <span className="settings-registry-badge" data-enabled={canEditScreenRegistry}>
                Platform Maintainer Mode
              </span>
            </div>

            <div className="settings-config-grid settings-registry-grid">
              <div className="settings-option-list">
                <div className="settings-column-head">
                  <span>Screen Text Key</span>
                </div>
                {bundle.screenTexts.map((screenText) => (
                  <Link
                    className="settings-option-item"
                    data-active={screenText.id === selectedScreenText?.id}
                    href={buildSettingsHref({
                      screen: screenText.name,
                      group: null,
                      setting: null,
                      task: null,
                      anchor: "screen-text-registry",
                    })}
                    key={screenText.id}
                  >
                    <strong>{screenText.name}</strong>
                    <small className="settings-option-subline">{screenText.location}</small>
                  </Link>
                ))}
              </div>

              <div className="settings-value-panel">
                <div className="settings-column-head">
                  <span>Managed Text</span>
                </div>
                {selectedScreenText ? (
                  <form
                    action={updateScreenTextAction}
                    className="settings-editor-form"
                    key={selectedScreenText.id}
                  >
                    <input name="return_to" type="hidden" value={returnTo} />
                    <input name="screen_id" type="hidden" value={selectedScreenText.id} />
                    <input name="screen_name" type="hidden" value={selectedScreenText.name} />
                    <input name="screen_location" type="hidden" value={selectedScreenText.location} />

                    <div className="settings-readonly-grid">
                      <div className="settings-readonly-box">
                        <span>Internal Key</span>
                        <strong>{selectedScreenText.name}</strong>
                      </div>
                      <div className="settings-readonly-box">
                        <span>Screen Location</span>
                        <strong>{selectedScreenText.location}</strong>
                      </div>
                    </div>

                    <div className="field">
                      <label className="settings-label" htmlFor="screen-display">
                        Display Text
                      </label>
                      <textarea
                        className="settings-textarea"
                        defaultValue={selectedScreenText.display}
                        id="screen-display"
                        name="display"
                        rows={4}
                      />
                    </div>

                    <div className="field">
                      <label className="settings-label" htmlFor="screen-note">
                        Maintainer Note
                      </label>
                      <textarea
                        className="settings-textarea"
                        defaultValue={selectedScreenText.note}
                        id="screen-note"
                        name="note"
                        rows={4}
                      />
                    </div>

                    <div className="settings-value-help">
                      <p>
                        Structural fields stay locked so this registry remains a controlled platform-maintainer tool, not
                        a general-purpose content editor.
                      </p>
                    </div>

                    <div className="settings-action-row">
                      <Link
                        className="button-secondary settings-action-button"
                        href={buildSettingsHref({
                          screen: selectedScreenText.name,
                          group: null,
                          setting: null,
                          task: null,
                          anchor: "screen-text-registry",
                        })}
                      >
                        Reset
                      </Link>
                      <button className="button settings-action-button" type="submit">
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="settings-empty-state">No managed screen text records were found.</p>
                )}
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </>
  );
}

function readParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function canEditPlatformContent(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "super_admin" || normalizedRole === "superadmin" || normalizedRole.includes("super")) {
    return true;
  }

  if (role.capabilities.some((capability) => capability.includes("manage platform options"))) {
    return true;
  }

  return role.permissionRows.some((permissionRow) => {
    const action = permissionRow.action.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return action === "platform_settings" && (permissionRow.create || permissionRow.update || permissionRow.menuAccess);
  });
}
