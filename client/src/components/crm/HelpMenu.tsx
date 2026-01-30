import { X } from "lucide-react";

export function HelpMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-help">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto">
        <div className="h-14 px-4 border-b border-border flex items-center justify-between">
          <div className="font-semibold">Help & Resources</div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <MenuItem href="https://docs.example.com" label="Documentation" testId="link-help-docs" />
          <MenuItem href="https://x.com/" label="Social media" testId="link-help-social" />
          <MenuItem href="#" label="What’s new" testId="link-help-whatsnew" />
        </div>
      </aside>
    </div>
  );
}

function MenuItem({ href, label, testId }: { href: string; label: string; testId: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="block rounded-xl px-4 py-3 text-sm hover:bg-muted/30 transition-colors border border-transparent hover:border-border font-medium"
      data-testid={testId}
    >
      {label}
    </a>
  );
}
