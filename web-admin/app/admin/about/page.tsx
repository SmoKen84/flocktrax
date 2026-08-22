import { PageHeader } from "@/components/page-header";
import {
  getPlatformScreenTextValues,
  getPlatformSplashContent,
  getPublishedPlatformVersions,
  type PublishedPlatformVersion,
} from "@/lib/platform-content";

import { InstallFlockTraxApp } from "./install-flocktrax-app";

function renderVersionSummary(version: PublishedPlatformVersion) {
  if (!version.versionLine) {
    return "Not published in platform.control yet.";
  }

  return version.versionLine;
}

export default async function AboutPage() {
  const [splash, versions, installText] = await Promise.all([
    getPlatformSplashContent(),
    getPublishedPlatformVersions(),
    getPlatformScreenTextValues(["admin_install_title", "install_admin_details"]),
  ]);
  const installTitle = installText.get("admin_install_title") || "Install FlockTrax on this computer";
  const installDetails =
    installText.get("install_admin_details") ||
    "Add FlockTrax with the chicken icon and open it in its own clean application window from the Windows desktop or Start menu.";

  return (
    <>
      <PageHeader
        eyebrow="Utilities"
        title="About FlockTrax"
        body="Use this page to confirm the currently published Admin and Mobile release markers that are stored in the hosted platform control table."
      />

      <section className="panel card about-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Current Published Versions</p>
            <h2>Published release markers</h2>
            <p className="table-subtitle">
              These values are the hosted version records the system is currently advertising for the Admin console and both Mobile platforms.
            </p>
          </div>
          {splash.versionLine ? (
            <span className="status-pill" data-tone="good">
              {splash.versionLine}
            </span>
          ) : null}
        </div>

        <div className="about-versions-grid">
          <article className="about-version-card">
            <div className="about-version-head">
              <div>
                <p className="about-version-label">FlockTrax-Admin</p>
                <p className="about-version-title">Admin Console</p>
              </div>
            </div>
            <p className="about-version-summary">{renderVersionSummary(versions.admin)}</p>
          </article>

          <article className="about-version-card">
            <div className="about-version-head">
              <div>
                <p className="about-version-label">FlockTrax-Mobile</p>
                <p className="about-version-title">Published mobile builds</p>
              </div>
            </div>

            <div className="about-version-stack">
              <div className="about-version-row">
                <div>
                  <p className="about-version-platform">iOS</p>
                  <p className="about-version-subtitle">iPhone (iOS)</p>
                </div>
                <p className="about-version-summary">{renderVersionSummary(versions.mobileIos)}</p>
              </div>

              <div className="about-version-row">
                <div>
                  <p className="about-version-platform">Android</p>
                  <p className="about-version-subtitle">Android</p>
                </div>
                <p className="about-version-summary">{renderVersionSummary(versions.mobileAndroid)}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <InstallFlockTraxApp details={installDetails} title={installTitle} />
    </>
  );
}
