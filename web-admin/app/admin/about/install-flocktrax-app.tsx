"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import {
  FLOCKTRAX_APP_INSTALLED_EVENT,
  FLOCKTRAX_INSTALL_READY_EVENT,
} from "@/components/pwa-install-listener";

type InstallState = "checking" | "available" | "installing" | "installed" | "manual";

type Props = {
  title: string;
  details: string;
};

function isRunningAsInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export function InstallFlockTraxApp({ title, details }: Props) {
  const [installState, setInstallState] = useState<InstallState>("checking");
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const syncInstallState = () => {
      if (isRunningAsInstalledApp()) {
        setInstallState("installed");
        return;
      }

      setInstallState(window.__flockTraxInstallPrompt ? "available" : "manual");
    };

    const handleInstalled = () => {
      setInstallState("installed");
      setShowInstructions(false);
    };

    syncInstallState();
    window.addEventListener(FLOCKTRAX_INSTALL_READY_EVENT, syncInstallState);
    window.addEventListener(FLOCKTRAX_APP_INSTALLED_EVENT, handleInstalled);

    return () => {
      window.removeEventListener(FLOCKTRAX_INSTALL_READY_EVENT, syncInstallState);
      window.removeEventListener(FLOCKTRAX_APP_INSTALLED_EVENT, handleInstalled);
    };
  }, []);

  async function installFlockTrax() {
    const installPrompt = window.__flockTraxInstallPrompt;
    if (!installPrompt) {
      setShowInstructions(true);
      setInstallState("manual");
      return;
    }

    setInstallState("installing");
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    delete window.__flockTraxInstallPrompt;

    if (choice.outcome === "accepted") {
      setInstallState("installed");
      setShowInstructions(false);
      return;
    }

    setInstallState("manual");
    setShowInstructions(true);
  }

  const buttonLabel = installState === "installed"
    ? "FlockTrax is installed"
    : installState === "installing"
      ? "Opening installer…"
      : installState === "available"
        ? "Install FlockTrax"
        : "Show installation steps";

  return (
    <section className="panel card about-install-panel">
      <div className="about-install-icon" aria-hidden="true">
        <Image alt="" height={72} src="/icon-192.png" width={72} />
      </div>
      <div className="about-install-content">
        <p className="eyebrow">Desktop App</p>
        <h2>{title}</h2>
        <p className="table-subtitle">{details}</p>

        <div className="about-install-actions">
          <button
            className="button-primary"
            disabled={installState === "checking" || installState === "installing" || installState === "installed"}
            onClick={() => void installFlockTrax()}
            type="button"
          >
            {buttonLabel}
          </button>
          {installState === "installed" ? (
            <span className="status-pill" data-tone="good">Installed</span>
          ) : null}
        </div>

        {showInstructions ? (
          <div className="about-install-instructions" role="status">
            <p><strong>Chrome:</strong> select the Install icon in the address bar, or open the browser menu and choose <em>Cast, save, and share → Install page as app</em>.</p>
            <p><strong>Microsoft Edge:</strong> open the browser menu and choose <em>Apps → Install FlockTrax Admin</em>.</p>
            <p>When offered, allow Windows to create the desktop shortcut. Browser policy may place the app in the Start menu first.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
