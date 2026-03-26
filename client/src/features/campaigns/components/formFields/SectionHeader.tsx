export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
        {label}
      </span>
    </div>
  );
}
