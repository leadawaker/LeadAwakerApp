// src/features/accounts/components/dialogWidgets/accountDialogConstants.tsx
import React from "react";
import { CheckCircle2, Clock, Ban, PauseCircle, HelpCircle } from "lucide-react";

export const STATUS_OPTIONS = ["Active", "Inactive", "Trial", "Suspended", "Unknown"];
export const TYPE_OPTIONS = ["Agency", "Client"];
export const TYPO_FREQUENCY_OPTIONS = ["None", "Rare", "Occasional", "Frequent"];
export const TIMEZONE_OPTIONS = [
  "America/Sao_Paulo",
  "Europe/Amsterdam",
];

// i18n key maps (data-as-labels pattern — safe at module level)
export const STATUS_I18N_KEY: Record<string, string> = {
  Active: "status.active",
  Inactive: "status.inactive",
  Trial: "status.trial",
  Suspended: "status.suspended",
  Unknown: "status.unknown",
};

export const TYPE_I18N_KEY: Record<string, string> = {
  Agency: "type.agency",
  Client: "type.client",
};

export const TYPO_FREQ_I18N_KEY: Record<string, string> = {
  None: "typoFrequency.none",
  Rare: "typoFrequency.rare",
  Occasional: "typoFrequency.occasional",
  Frequent: "typoFrequency.frequent",
};

export function statusBadgeProps(status: string) {
  switch (status) {
    case "Active":
      return {
        icon: <CheckCircle2 className="h-3 w-3" />,
        cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
      };
    case "Trial":
      return {
        icon: <Clock className="h-3 w-3" />,
        cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
      };
    case "Suspended":
      return {
        icon: <Ban className="h-3 w-3" />,
        cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
      };
    case "Inactive":
      return {
        icon: <PauseCircle className="h-3 w-3" />,
        cls: "bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/25",
      };
    default:
      return {
        icon: <HelpCircle className="h-3 w-3" />,
        cls: "bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/25",
      };
  }
}
