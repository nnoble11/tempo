"use client";

import type { ReactNode } from "react";

import { AppNavigation } from "./AppNavigation";

export function FeatureShell({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <main className="shell featureShell" id="main-content">
      <header className="topbar">
        <a className="wordmark" href="/">
          tempo
        </a>
        <AppNavigation />
      </header>
      <section aria-labelledby="feature-title" className="featureHero">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="feature-title">{title}</h1>
        <p className="muted">{copy}</p>
      </section>
      {children}
    </main>
  );
}
