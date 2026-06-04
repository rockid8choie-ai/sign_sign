import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-indigo-50 text-indigo-600",
  in_progress: "bg-amber-50 text-amber-600",
  completed: "bg-emerald-50 text-emerald-600",
  declined: "bg-red-50 text-red-600",
  voided: "bg-slate-100 text-slate-400",
  expired: "bg-slate-100 text-slate-400",
  pending: "bg-slate-100 text-slate-500",
  viewed: "bg-blue-50 text-blue-600",
  signed: "bg-emerald-50 text-emerald-600",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`badge ${STATUS_COLORS[value] ?? "bg-slate-100 text-slate-600"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {label ?? value}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[1.65rem] font-bold tracking-tight text-[#191f28]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-[#8b95a1]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message, cta }: { message: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e0e4e8] bg-white/60 p-12 text-center">
      <p className="text-sm text-[#8b95a1]">{message}</p>
      {cta && <div className="mt-4 flex justify-center">{cta}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <div className="text-sm font-medium text-[#8b95a1]">{label}</div>
      <div className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-[#191f28]">{value}</div>
      {hint && <div className="mt-2 text-xs text-[#b0b8c1]">{hint}</div>}
    </div>
  );
}

export function ListRow({
  title,
  subtitle,
  value,
  href,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className={`list-row ${href ? "list-row-tap" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#191f28]">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-[#8b95a1]">{subtitle}</div>}
      </div>
      {value != null && <div className="shrink-0 text-sm font-semibold text-[#4e5968]">{value}</div>}
      {href && <span className="shrink-0 text-lg leading-none text-[#c4cad1]">›</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function fmtDate(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
