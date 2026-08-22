"use client";

import { useEffect } from "react";

export type FlockTraxInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __flockTraxInstallPrompt?: FlockTraxInstallPrompt;
  }
}

export const FLOCKTRAX_INSTALL_READY_EVENT = "flocktrax:install-ready";
export const FLOCKTRAX_APP_INSTALLED_EVENT = "flocktrax:app-installed";

export function PwaInstallListener() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__flockTraxInstallPrompt = event as FlockTraxInstallPrompt;
      window.dispatchEvent(new Event(FLOCKTRAX_INSTALL_READY_EVENT));
    };

    const handleAppInstalled = () => {
      delete window.__flockTraxInstallPrompt;
      window.dispatchEvent(new Event(FLOCKTRAX_APP_INSTALLED_EVENT));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
