"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, FolderKanban, ListChecks, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export type Hit = {
  id: string;
  kind: "project" | "task" | "document" | "supplier";
  title: string;
  subtitle: string;
  href: string;
};

export const ICONS = {
  project: FolderKanban,
  task: ListChecks,
  document: FileText,
  supplier: Building2,
} as const;

const OPEN_EVENT = "vionex:search";

/**
 * Opens the one mounted palette from anywhere (the rail, the mobile header).
 * An event rather than a second palette: two instances would both answer ⌘K
 * and toggle each other shut.
 */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * The debounced cross-entity lookup behind both search surfaces (the ⌘K
 * palette and the sidebar's magnifier). The result carries the term it
 * belongs to, so "no results" only shows once that term was searched, and a
 * stale flag keeps out-of-order responses from winning.
 */
export function useSearchHits(term: string, onResults?: () => void) {
  const [result, setResult] = React.useState<{ term: string; hits: Hit[] } | null>(null);
  const ready = term.trim().length >= 2;
  const visible = ready ? (result?.hits ?? []) : [];
  const settled = result?.term === term;
  const notify = React.useRef(onResults);
  React.useEffect(() => {
    notify.current = onResults;
  });

  React.useEffect(() => {
    if (!ready) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = (await res.json()) as { results?: Hit[] };
        if (!stale) {
          setResult({ term, hits: data.results ?? [] });
          notify.current?.();
        }
      } catch {
        if (!stale) setResult({ term, hits: [] });
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [term, ready]);

  return { ready, visible, settled };
}

/** Icon-only search button (mobile header) that opens the mounted palette. */
export function SearchTrigger({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label={label}
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink",
        className,
      )}
    >
      <Search className="size-[18px]" />
    </button>
  );
}

/**
 * Cross-entity search reachable from anywhere with ⌘K / Ctrl+K. Results are
 * scoped server-side, so the same component serves both environments.
 *
 * `trigger="field"` (default) renders its own search-field button;
 * `trigger="none"` renders only the dialog, opened by ⌘K or
 * `openCommandPalette()`.
 */
export function CommandPalette({
  labels,
  trigger = "field",
}: {
  labels: { placeholder: string; empty: string; hint: string; groups: Record<Hit["kind"], string> };
  trigger?: "field" | "none";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const { ready, visible, settled } = useSearchHits(term, () => setActive(0));

  const go = (hit: Hit) => {
    setOpen(false);
    setTerm("");
    router.push(hit.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (visible.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % visible.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + visible.length) % visible.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = visible[active];
      if (hit) go(hit);
    }
  };

  return (
    <>
      {trigger === "field" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-sm border border-line bg-surface px-3 text-[13px] text-muted transition-colors",
            "hover:border-line-strong hover:text-ink-soft",
          )}
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">{labels.placeholder}</span>
          <kbd className="ml-2 hidden rounded-xs border border-line bg-subtle px-1.5 py-0.5 font-sans text-[10px] text-faint sm:inline">
            ⌘K
          </kbd>
        </button>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTerm("");
        }}
      >
        <DialogContent className="top-[18%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogPrimitive.Title className="sr-only">{labels.placeholder}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{labels.hint}</DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-faint" />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
              className="h-12 w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </div>

          <div className="scroll-slim max-h-[54vh] overflow-y-auto p-1.5">
            {!ready ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted">{labels.hint}</p>
            ) : !settled && visible.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted">…</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted">{labels.empty}</p>
            ) : (
              <ul>
                {visible.map((hit, index) => {
                  const Icon = ICONS[hit.kind];
                  return (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <button
                        type="button"
                        onClick={() => go(hit)}
                        onMouseEnter={() => setActive(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors",
                          index === active ? "bg-raised" : "hover:bg-subtle",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {hit.title}
                          </span>
                          <span className="block truncate text-[12px] text-muted">
                            {hit.subtitle}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] tracking-wide text-faint uppercase">
                          {labels.groups[hit.kind]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
