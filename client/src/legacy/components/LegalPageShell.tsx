import type { ReactNode } from "react";
import Seo from "../lib/seo";
import "../styles/theme.css";

export interface LegalSection {
  title: string;
  /** Body paragraphs. Each entry renders as its own <p>. */
  body: ReactNode[];
}

interface LegalPageShellProps {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export function LegalPageShell({ title, lastUpdated, sections }: LegalPageShellProps) {
  return (
    <div className="legacy-app">
      <Seo title={title} />
      <div className="min-h-screen pt-[126px] pb-24 bg-slate-50 dark:bg-muted">
        <div className="container mx-auto px-6 md:px-12 max-w-3xl">
          <div className="bg-white dark:bg-card rounded-3xl p-8 md:p-12 shadow-xl">
            <h1 className="text-4xl font-bold mb-2">{title}</h1>
            <p className="text-sm text-muted-foreground mb-10">{lastUpdated}</p>

            {sections.map((section, i) => (
              <section key={i} className="mb-8 last:mb-0">
                <h2 className="text-xl font-bold mb-3">{section.title}</h2>
                {section.body.map((para, j) => (
                  <p key={j} className="text-muted-foreground leading-relaxed mb-3 last:mb-0">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
