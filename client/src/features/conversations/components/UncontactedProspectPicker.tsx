/**
 * UncontactedProspectPicker — slide-in dialog that lists prospects with no WhatsApp
 * conversations yet. Used by the "+" button in the Prospects inbox toolbar.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getProspectAvatarColor } from "@/lib/avatarUtils";
import { Search, X, PhoneOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (prospectId: number) => void;
  /** IDs of prospects that already have conversations — these are excluded */
  existingProspectIds: number[];
}

export function UncontactedProspectPicker({ open, onClose, onSelect, existingProspectIds }: Props) {
  const [search, setSearch] = useState("");

  const { data: allProspects = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/prospects"],
    enabled: open,
  });

  const uncontacted = useMemo(() => {
    return allProspects.filter((p: any) => !existingProspectIds.includes(p.id ?? p.Id));
  }, [allProspects, existingProspectIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return uncontacted;
    const q = search.toLowerCase();
    return uncontacted.filter((p: any) => {
      const haystack = [p.company, p.name, p.contact_name, p.contactName, p.contact_email, p.contactEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [uncontacted, search]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-black/[0.06]">
          <DialogTitle className="text-[16px] font-semibold">Start new WhatsApp chat</DialogTitle>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Prospects not yet messaged via WhatsApp
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 h-9 px-3 rounded-full border border-black/[0.125] bg-background">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or company…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[360px] px-2 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">{search ? "No matching prospects" : "All prospects already have conversations"}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-[3px]">
              {filtered.map((p: any) => {
                const pid = p.id ?? p.Id;
                const name = p.company || p.name || "Unknown";
                const contactName = p.contact_name || p.contactName;
                const phone = p.contact_phone || p.contactPhone || p.phone;
                const avatarColor = getProspectAvatarColor(p.outreach_status || p.outreachStatus);

                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => onSelect(pid)}
                    className="w-full text-left rounded-xl px-2.5 py-2 flex items-center gap-2.5 hover:bg-card-hover transition-colors"
                  >
                    <EntityAvatar name={name} bgColor={avatarColor.bg} textColor={avatarColor.text} size={36} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold font-heading leading-tight truncate text-foreground">{name}</p>
                      {contactName && (
                        <p className="text-[11px] text-muted-foreground leading-tight truncate">{contactName}</p>
                      )}
                    </div>
                    {!phone && (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] text-orange-500/80 bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 rounded-full px-1.5 py-0.5">
                        <PhoneOff className="h-2.5 w-2.5" />
                        No phone
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
