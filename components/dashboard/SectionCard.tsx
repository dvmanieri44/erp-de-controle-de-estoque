type SectionCardProps = {
  title: string;
  value: string;
  helper: string;
};

export function SectionCard({ title, value, helper }: SectionCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm transition-colors">
      <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--navy-900)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{helper}</p>
    </article>
  );
}
