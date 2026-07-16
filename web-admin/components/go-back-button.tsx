"use client";

import { useRouter } from "next/navigation";

export function GoBackButton({ fallbackHref = "/admin/flocks" }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      className="button-secondary"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref);
      }}
      type="button"
    >
      Go Back...
    </button>
  );
}
