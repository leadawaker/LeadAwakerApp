import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function HelpMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button className="hidden" aria-hidden data-testid="help-trigger-hidden" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          align="start"
          sideOffset={10}
          className="z-[90] min-w-[220px] rounded-2xl border border-border bg-background shadow-xl p-1"
          data-testid="menu-help"
        >
          <MenuItem href="https://docs.example.com" label="Documentation" testId="link-help-docs" />
          <MenuItem href="https://x.com/" label="Social media" testId="link-help-social" />
          <MenuItem href="#" label="What’s new" testId="link-help-whatsnew" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({ href, label, testId }: { href: string; label: string; testId: string }) {
  return (
    <DropdownMenu.Item asChild>
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className="block rounded-xl px-3 py-2 text-sm hover:bg-muted/30 outline-none"
        data-testid={testId}
      >
        {label}
      </a>
    </DropdownMenu.Item>
  );
}
