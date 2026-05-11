"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref?: string;
  className?: string;
};

export function IssuesBackButton({
  fallbackHref = "/admin/overview",
  className,
}: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      className={className}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref);
      }}
      type="button"
    >
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
