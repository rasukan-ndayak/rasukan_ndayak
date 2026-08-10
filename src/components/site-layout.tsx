import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-b border-border bg-primary-soft/40">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{title}</h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </section>
  );
}