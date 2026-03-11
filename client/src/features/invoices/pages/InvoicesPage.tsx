import { Receipt } from "lucide-react";

export function InvoicesPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3.5 pt-5 pb-1 shrink-0">
        <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Invoices</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Receipt className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Invoices coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">Invoice management will be available here.</p>
        </div>
      </div>
    </div>
  );
}
