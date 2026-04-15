import { useState } from "react";
import { Send, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface EmailComposerProps {
  prospectId: number;
  prospectEmail: string | null | undefined;
  contactEmail?: string | null | undefined;
  contact2Email?: string | null | undefined;
  prospectName?: string;
  onOpenEmailModal: () => void;
}

export function EmailComposer({
  prospectId,
  prospectEmail,
  contactEmail,
  contact2Email,
  prospectName,
  onOpenEmailModal
}: EmailComposerProps) {
  const { t } = useTranslation("prospects");

  // Check if we have any email address
  const hasEmail = prospectEmail || contactEmail || contact2Email;
  const primaryEmail = contactEmail || prospectEmail || contact2Email;

  if (!hasEmail) {
    return (
      <p className="text-[11px] text-muted-foreground/50 italic">
        No email address on file
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        <span>Send to: {primaryEmail}</span>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-9 rounded-xl gap-1.5"
          onClick={onOpenEmailModal}
        >
          <Send className="h-3.5 w-3.5" />
          {t("emailCompose.sendEmail")}
        </Button>
      </div>
    </div>
  );
}