import { useTranslation } from "react-i18next";
import { Laptop } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import type { TwoFactorStatus } from "./types";

/** "Chrome on macOS" from a raw user agent. Display only. */
export function browserLabel(ua: string | null): string {
  if (!ua) return "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

export function DevicesList({
  devices, onRevoke, onRevokeAll,
}: {
  devices: TwoFactorStatus["devices"]; onRevoke: (id: number) => void; onRevokeAll: () => void;
}) {
  const { t } = useTranslation("settings");
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  return (
    <div className="space-y-2" data-testid="list-trusted-devices">
      {devices.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 min-h-11">
          <Laptop className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground flex items-center gap-2 flex-wrap">
              {browserLabel(d.userAgent) || t("twoFactor.devices.unknown")}
              {d.current && <Pill color="hsl(var(--success))">{t("twoFactor.devices.thisBrowser")}</Pill>}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("twoFactor.devices.expires", { date: fmt(d.expiresAt) })}
              {d.lastUsedAt ? ` · ${t("twoFactor.devices.lastUsed", { date: fmt(d.lastUsedAt) })}` : ""}
            </div>
          </div>
          <button type="button" onClick={() => onRevoke(d.id)} className="la-btn la-btn--plain text-xs" data-testid={`button-revoke-device-${d.id}`}>
            {t("twoFactor.devices.revoke")}
          </button>
        </div>
      ))}
      {devices.length > 1 && (
        <button type="button" onClick={onRevokeAll} className="text-xs font-semibold hover:opacity-80" style={{ color: "var(--wine)" }} data-testid="button-revoke-all-devices">
          {t("twoFactor.devices.revokeAll")}
        </button>
      )}
    </div>
  );
}
