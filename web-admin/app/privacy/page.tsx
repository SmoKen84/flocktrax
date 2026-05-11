import Link from "next/link";
import type { Metadata } from "next";

import { getPlatformPolicyByName } from "@/lib/platform-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FlockTrax Privacy Policy",
  description: "Privacy Policy for FlockTrax-MOBILE and related FlockTrax services.",
};

function renderPolicyBlock(block: string, index: number) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  if (index === 0) {
    return <h1 className="policy-title" key={`block-${index}`}>{lines.join(" ")}</h1>;
  }

  if (lines[0].toLowerCase().startsWith("last updated:")) {
    return <p className="policy-updated" key={`block-${index}`}>{lines[0]}</p>;
  }

  const allBullets = lines.every((line) => line.startsWith("- "));
  if (allBullets) {
    return (
      <ul className="policy-list" key={`block-${index}`}>
        {lines.map((line) => (
          <li key={line}>{line.slice(2)}</li>
        ))}
      </ul>
    );
  }

  if (lines.length === 1 && lines[0].length <= 48 && !/[.:]/.test(lines[0])) {
    return <h2 className="policy-heading" key={`block-${index}`}>{lines[0]}</h2>;
  }

  if (lines.length === 1 && /^\d+\./.test(lines[0])) {
    return <h3 className="policy-subheading" key={`block-${index}`}>{lines[0]}</h3>;
  }

  return (
    <div className="policy-paragraph-group" key={`block-${index}`}>
      {lines.map((line) => {
        if (/^\d+\./.test(line)) {
          return <h3 className="policy-subheading" key={line}>{line}</h3>;
        }

        return <p className="policy-copy" key={line}>{line}</p>;
      })}
    </div>
  );
}

export default async function PrivacyPage() {
  const policy = await getPlatformPolicyByName("privacy");
  const blocks = policy?.body.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean) ?? [];

  return (
    <main className="policy-shell">
      <div className="policy-backdrop" aria-hidden="true" />

      <section className="policy-panel">
        <div className="policy-topbar">
          <Link className="policy-home-link" href="/">
            Return Home
          </Link>
          <p className="policy-label">Public Policy Page</p>
        </div>

        {policy ? (
          <article className="policy-article">
            {blocks.map((block, index) => renderPolicyBlock(block, index))}
          </article>
        ) : (
          <article className="policy-article">
            <h1 className="policy-title">FlockTrax Privacy Policy</h1>
            <p className="policy-copy">
              The Privacy Policy is not currently available. Please contact FlockTrax support for assistance.
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
