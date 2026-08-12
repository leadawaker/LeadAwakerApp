/**
 * The Clients tab on the Campaigns page — the saved demo persona library
 * (specs/demo-persona-library/plan.md, phase 1).
 *
 * "Which Client is open" is controlled from CampaignListView (selectedNiche /
 * onSelectNiche), not local state here: the topbar's "..." menu
 * (ClientActionsMenu.tsx) needs to know which Client is open too, and it
 * lives in CampaignListView's shared topbar, a sibling of this tab's body.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Users, Loader2 } from "lucide-react";
import { GroupHeader } from "@/components/crm/primitives/GroupHeader";
import { useDemoClients, formatClientTitle, type DemoClientSummary } from "../../api/demoClientsApi";
import { ClientEditor } from "./ClientEditor";

export function ClientsTab({
  selectedNiche,
  onSelectNiche,
}: {
  selectedNiche: string | null;
  onSelectNiche: (niche: string | null) => void;
}) {
  const { t } = useTranslation("campaigns");
  const { data: clients, isLoading } = useDemoClients();
  const [search, setSearch] = useState("");

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

  // Grouped by category, alphabetical, "Uncategorized" last — the fix for a
  // flat 23+ card grid nobody could scan.
  const groups = useMemo(() => {
    const byCategory = new Map<string, DemoClientSummary[]>();
    for (const c of filtered) {
      const key = (c.category ?? "").trim();
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(c);
    }
    const named = Array.from(byCategory.keys())
      .filter((k) => k !== "")
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ label, items: byCategory.get(label)! }));
    const uncategorized = byCategory.get("");
    if (uncategorized?.length) {
      named.push({ label: t("clients.noCategory", "Uncategorized"), items: uncategorized });
    }
    return named;
  }, [filtered, t]);

  return (
    <div className="h-full overflow-y-auto min-h-0" style={{ padding: "22px 24px" }}>
      <div className="max-w-[1386px] mr-auto">
        {selectedNiche ? (
          <ClientEditor niche={selectedNiche} onBack={() => onSelectNiche(null)} />
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

            {/* ── Grouped list ── */}
            {isLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--mute)", padding: 24 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span style={{ fontSize: 13 }}>{t("clients.loading", "Loading...")}</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients ?? []).length > 0} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {groups.map((g) => (
                  <div key={g.label}>
                    <GroupHeader label={g.label} count={g.items.length} />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
                        gap: 12,
                        padding: "12px 0 20px",
                      }}
                    >
                      {g.items.map((c) => (
                        <ClientCard key={c.id} client={c} onOpen={() => onSelectNiche(c.niche)} />
                      ))}
                    </div>
                  </div>
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
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>
        {formatClientTitle(client)}
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
