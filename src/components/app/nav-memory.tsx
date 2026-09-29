"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Remembers the last full URL (query included) of every page visited in this
 * tab, so a way *up* — a breadcrumb or a back arrow pointing at `/projects` —
 * lands on the list exactly as it was left: same status, filters, search and
 * page. Session storage keeps it per tab and forgets it with the tab.
 *
 * Presentation only: the stored URL is one the user already opened, and each
 * page still validates its own params on the server.
 */
const PREFIX = "vx:last:";
const EVENT = "vx:nav-memory";
/** Params that describe a transient overlay, not the list's state. */
const TRANSIENT = ["task"];

/** Client navigations since the tab loaded: > 0 means `router.back()` stays in the app. */
let inAppNavigations = 0;

function record(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  for (const key of TRANSIENT) params.delete(key);
  const query = params.toString();
  try {
    sessionStorage.setItem(PREFIX + pathname, query ? `${pathname}?${query}` : pathname);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage blocked (private mode): links keep their plain href.
  }
}

function Recorder() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) first.current = false;
    else inAppNavigations += 1;
    record(pathname, search);
  }, [pathname, search]);

  return null;
}

/** Mounted once per shell (internal and supplier layouts). */
export function NavMemory() {
  // `useSearchParams` needs a Suspense boundary of its own.
  return (
    <React.Suspense fallback={null}>
      <Recorder />
    </React.Suspense>
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/**
 * `href` upgraded to the remembered state of that page. Only a bare path is
 * upgraded — an href that already carries a query is a deliberate filter
 * (e.g. "3 atrasadas" → `/tasks?tab=OVERDUE`) and is left alone.
 */
export function useRememberedHref(href: string) {
  return React.useSyncExternalStore(
    subscribe,
    () => {
      if (href.includes("?")) return href;
      try {
        return sessionStorage.getItem(PREFIX + href) ?? href;
      } catch {
        return href;
      }
    },
    () => href,
  );
}

export function RememberedLink({
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  return <Link href={useRememberedHref(href)} {...props} />;
}

/**
 * "← Voltar". Goes up to `href` in its remembered state; with `history`, it
 * steps back through the browser history instead when the previous entry is
 * inside the app (a record reachable from many lists), and falls back to
 * `href` on a fresh tab or a link opened from an e-mail.
 */
export function BackLink({
  href,
  label,
  showLabel = false,
  history = false,
  className,
}: {
  href: string;
  /** Accessible name, e.g. "Voltar para Projetos". */
  label: string;
  /** Show the text beside the arrow; icon-only otherwise. */
  showLabel?: boolean;
  history?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const target = useRememberedHref(href);

  return (
    <Link
      href={target}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      onClick={(event) => {
        if (!history || inAppNavigations === 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        router.back();
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-sm text-label font-medium text-muted transition-colors hover:bg-raised hover:text-ink",
        showLabel ? "h-7 px-1.5" : "size-7 justify-center",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {showLabel ? label : null}
    </Link>
  );
}

/**
 * "← Voltar" as a button, for error and not-found screens: back through the
 * history when the previous entry is in the app, `fallbackHref` otherwise —
 * so nobody is left on a dead end with only "try again".
 */
export function HistoryBackButton({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (inAppNavigations > 0 ? router.back() : router.push(fallbackHref))}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-sm px-3.5 text-sm font-medium text-ink-soft transition-colors hover:bg-raised hover:text-ink [&_svg]:size-4",
        className,
      )}
    >
      <ArrowLeft aria-hidden />
      {label}
    </button>
  );
}
