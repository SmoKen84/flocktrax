"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function OutboxRefreshButton() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  return (
    <button
      className="button-secondary sync-outbox-refresh-button"
      type="button"
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      disabled={isRefreshing}
    >
      {isRefreshing ? "Refreshing..." : "Refresh Queue"}
    </button>
  );
}
