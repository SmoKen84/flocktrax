import type { ReactNode } from "react";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  body: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, body, actions }: PageHeaderProps) {
  return (
    <section className="panel hero-panel">
      <p className="hero-kicker">{eyebrow}</p>
      <FlockTraxWordmark compact product="Admin" tone="accent" />
      <div className="section-header">
        <div>
          <h1 className="hero-title" style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
            {title}
          </h1>
          <p className="hero-body">{body}</p>
        </div>
        {actions ? <div className="hero-actions">{actions}</div> : null}
      </div>
    </section>
  );
}
