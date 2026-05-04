"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const SESSION_EXPIRED_EVENT = "flocktrax:session-expired";
const SESSION_RESTORED_EVENT = "flocktrax:session-restored";

type SessionExpiredDetail = {
  reason?: string;
};

function dispatchSessionExpired(detail?: SessionExpiredDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail }));
}

function dispatchSessionRestored() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_RESTORED_EVENT));
}

export function reportSessionExpired(reason?: string) {
  dispatchSessionExpired({ reason });
}

export function SessionRecoveryLayer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        dispatchSessionExpired({ reason: "Your sign-in session expired. Sign in again without leaving this screen." });
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!supabase || typeof window === "undefined") {
      return;
    }

    const handleExpired = (event: Event) => {
      const detail = (event as CustomEvent<SessionExpiredDetail>).detail;
      setReason(detail?.reason ?? "Your sign-in session expired. Sign in again without losing what you were working on.");
      setMessage(null);
      setPassword("");
      setOpen(true);
    };

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (!session && event === "INITIAL_SESSION")) {
        setReason("Your sign-in session expired. Sign in again without losing what you were working on.");
        setMessage(null);
        setPassword("");
        setOpen(true);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setOpen(false);
        setBusy(false);
        setPassword("");
        setMessage(null);
        dispatchSessionRestored();
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void supabase.auth.getSession();
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired as EventListener);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.data.subscription.unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired as EventListener);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [supabase]);

  async function handleSignIn() {
    if (!supabase) {
      setMessage("Browser authentication is not configured for this app.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage("Enter your email and password to restore the session.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    setBusy(false);
    setOpen(false);
    setPassword("");
    setMessage(null);
    dispatchSessionRestored();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="sync-outbox-modal-shell" role="presentation">
      <div
        aria-labelledby="session-recovery-title"
        aria-modal="true"
        className="sync-outbox-modal-panel session-recovery-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="sync-outbox-modal-header">
          <div>
            <p className="eyebrow">Session Recovery</p>
            <h3 className="section-title" id="session-recovery-title">
              Your JWT expired.
            </h3>
          </div>
        </div>

        <p className="session-recovery-copy">
          {reason ?? "Your sign-in session expired. Sign in again without losing what you were working on."}
        </p>

        <div className="session-recovery-grid">
          <label className="feed-ticket-editor-field">
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label className="feed-ticket-editor-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
        </div>

        {message ? <div className="feed-ticket-editor-banner is-error">{message}</div> : null}

        <div className="session-recovery-actions">
          <button className="button" disabled={busy} onClick={() => void handleSignIn()} type="button">
            {busy ? "Signing In..." : "Sign In Again"}
          </button>
          <Link className="button-secondary" href="/login">
            Open Login Screen
          </Link>
        </div>
      </div>
    </div>
  );
}
