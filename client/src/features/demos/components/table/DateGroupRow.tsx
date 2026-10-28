/**
 * A date heading between table rows: the label and count between two hairlines, as GroupHeader draws
 * it. Not GroupHeader itself: its shadow halo (there to mask rows scrolling under a sticky header)
 * would paint over the bottom of the row above.
 */
export function DateGroupRow({ label, count, span }: { label: string; count: number; span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-3 pb-1 pt-4">
        <div className="flex items-center gap-[10px]">
          <div className="h-px flex-1 bg-foreground/15" />
          <span className="shrink-0 text-[12px] font-bold tracking-wide text-foreground">{label}</span>
          <span className="shrink-0 text-foreground/20">{"–"}</span>
          <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">{count}</span>
          <div className="h-px flex-1 bg-foreground/15" />
        </div>
      </td>
    </tr>
  );
}
