/**
 * The Clients tab on the Campaigns page — the saved demo persona library
 * (specs/demo-persona-library/plan.md, phase 1).
 *
 * This is the durable half of the demo. "Who is this demo for" lives here;
 * "run it now" (scenario, lead name, company override) lives on campaign 60's
 * AI tab. Personas land here automatically whenever a demo link is minted from
 * the Share dialog or regenerated with /generate, so the list fills itself.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Users, Loader2 } from "lucide-react";
import { useDemoClients, type DemoClientSummary } from "../../api/demoClientsApi";
import { ClientEditor } from "./ClientEditor";

export function ClientsTab() {
  const { t } = useTranslation("campaigns");
  const { data: clients, isLoading } = useDemoClients();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = clients ?? [];
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.niche.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="h-full overflow-y-auto min-h-0" style={{ padding: "22px 24px" }}>
      <div className="max-w-[1386px] mr-auto">
        {selected ? (
          <ClientEditor
            niche={selected}
            onBack={() => setSelected(null)}
            onDeleted={() => setSelected(null)}
          />
        ) : (
          <>
            {/* ── Header ── */}
            <div style={{ marginBottom: 20 }}>
              <div className="eyebrow wine" style={{ marginBottom: 8 }}>
                {t("clients.eyebrow", "Demo personas")}
              </div>
              <div
                className="serif italic"
                style={{ fontSize: 40, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em", marginBottom: 10 }}
              >
                {t("clients.title", "Clients")}
              </div>
              <p style={{ fontSize: 14, color: "var(--mute)", maxWidth: 620, lineHeight: 1.55 }}>
                {t("clients.intro")}
              </p>
            </div>

            {/* ── Search ── */}
            <div style={{ position: "relative", maxWidth: 320, marginBottom: 18 }}>
              <Search
                className="h-4 w-4"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--mute-2)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("clients.searchPlaceholder", "Search Clients...")}
                style={{
                  width: "100%",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "var(--input)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-input, 10px)",
                  padding: "9px 12px 9px 34px",
                }}
              />
            </div>

            {/* ── List ── */}
            {isLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--mute)", padding: 24 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span style={{ fontSize: 13 }}>{t("clients.loading", "Loading...")}</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients ?? []).length > 0} />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
                  gap: 12,
                }}
              >
                {filtered.map((c) => (
                  <ClientCard key={c.id} client={c} onOpen={() => setSelected(c.niche)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClientCard({ client, onOpen }: { client: DemoClientSummary; onOpen: () => void }) {
  const { t } = useTranslation("campaigns");
  return (
    <button
      onClick={onOpen}
      className="neu-raised"
      style={{
        textAlign: "left",
        padding: 18,
        borderRadius: "var(--r-card)",
        border: "none",
        cursor: "pointer",
        background: "var(--paper)",
        transition: "box-shadow 150ms, transform 150ms",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
        {client.label || client.niche}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--mute)", lineHeight: 1.4 }}>
        {client.companyName || t("clients.noCompany", "No company name yet")}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
        {client.languages.length === 0 ? (
          <span
            style={{
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 9.5,
              letterSpacing: "0.1em",
              color: "var(--mute-2)",
            }}
          >
            {t("clients.vocabOnly", "WORDS ONLY")}
          </span>
        ) : (
          client.languages.map((l) => (
            <span
              key={l}
              style={{
                fontFamily: "Geist Mono, ui-monospace, monospace",
                fontSize: 9.5,
                letterSpacing: "0.1em",
                color: "var(--wine)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "2px 7px",
              }}
            >
              {l.toUpperCase()}
            </span>
          ))
        )}
      </div>
    </button>
  );
}

function EmptyState({ hasClients }: { hasClients: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div
      className="neu-inset"
      style={{
        padding: 40,
        borderRadius: "var(--r-card)",
        textAlign: "center",
        color: "var(--mute)",
      }}
    >
      <Users className="h-6 w-6" style={{ margin: "0 auto 12px", color: "var(--mute-2)" }} />
      <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
        {hasClients ? t("clients.noMatches") : t("clients.emptyLibrary")}
      </p>
    </div>
  );
}
