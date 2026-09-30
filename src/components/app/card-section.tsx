import Link from "next/link";

/** A page section as a light card with a roomy title row (project overview, dashboard). */
export function CardSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-line-soft bg-surface">
      <header className="flex min-h-14 items-center justify-between gap-3 px-6 pt-5 pb-3">
        <h2 className="text-title text-ink">
          {title}
          {count ? <span className="ml-2 font-normal text-faint tabular-nums">{count}</span> : null}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-label font-medium text-brand-strong hover:underline">
      {children}
    </Link>
  );
}

