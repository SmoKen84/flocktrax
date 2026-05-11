import Link from "next/link";
import type { Metadata } from "next";

import { getPlatformPolicyByName } from "@/lib/platform-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FlockTrax Delete Account",
  description: "Account deletion instructions for FlockTrax-MOBILE.",
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

  const numbered = lines.every((line) => /^\d+\./.test(line));
  if (numbered) {
    return (
      <ol className="policy-list policy-list-numbered" key={`block-${index}`}>
        {lines.map((line) => (
          <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
        ))}
      </ol>
    );
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

  return (
    <div className="policy-paragraph-group" key={`block-${index}`}>
      {lines.map((line) => (
        <p className="policy-copy" key={line}>
          {line.includes("FlockTrax Privacy Policy") ? (
            <>
              {line.replace("FlockTrax Privacy Policy", "")}
              <Link className="policy-inline-link" href="/privacy">
                FlockTrax Privacy Policy
              </Link>
            </>
          ) : (
            line
          )}
        </p>
      ))}
    </div>
  );
}

export default async function DeleteAccountPage() {
  const policy = await getPlatformPolicyByName("delete_account");
  const blocks = policy?.body.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean) ?? [];

  return (
    <main className="policy-shell">
      <div className="policy-backdrop" aria-hidden="true" />

      <section className="policy-panel">
        <div className="policy-topbar">
          <Link className="policy-home-link" href="/">
            Return Home
          </Link>
          <p className="policy-label">Public Support Page</p>
        </div>

        {policy ? (
          <article className="policy-article">
            {blocks.map((block, index) => renderPolicyBlock(block, index))}
          </article>
        ) : (
          <article className="policy-article">
            <h1 className="policy-title">FlockTrax Account Deletion</h1>
            <p className="policy-copy">
              Account deletion instructions are not currently available. Please contact FlockTrax support for
              assistance.
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
