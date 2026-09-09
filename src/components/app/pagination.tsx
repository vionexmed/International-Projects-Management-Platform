import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Server-rendered pagination: each page is a link that carries the current
 * filters forward.
 */
export function Pagination({
  page,
  pageCount,
  total,
  perPage,
  searchParams,
  label,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  searchParams: Record<string, string | undefined>;
  label: string;
}) {
  const buildHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `?${query}` : "?";
  };

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <>
      <span>
        Exibindo {from} a {to} de {total} {label}
      </span>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink href={buildHref(page - 1)} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </PageLink>
          <span className="px-2 text-[13px] font-medium text-ink tabular-nums">
            {page} / {pageCount}
          </span>
          <PageLink href={buildHref(page + 1)} disabled={page >= pageCount} aria-label="Próxima página">
            <ChevronRight className="size-4" />
          </PageLink>
        </div>
      ) : null}
    </>
  );
}

function PageLink({
  href,
  disabled,
  children,
  ...props
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
  "aria-label": string;
}) {
  const className = cn(
    "inline-flex size-8 items-center justify-center rounded-sm border border-line transition-colors",
    disabled
      ? "pointer-events-none text-faint opacity-50"
      : "text-ink-soft hover:bg-raised hover:text-ink",
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled {...props}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}
