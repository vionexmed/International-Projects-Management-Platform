"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Writes a key into the query string, resetting pagination. */
function useParamWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
}

export function SearchInput({
  placeholder,
  paramKey = "q",
  className,
}: {
  placeholder: string;
  paramKey?: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const write = useParamWriter();
  const [value, setValue] = React.useState(searchParams.get(paramKey) ?? "");
  const initial = React.useRef(true);

  // Debounced so typing does not fire a navigation per keystroke.
  React.useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    const timer = setTimeout(() => write({ [paramKey]: value || null }), 350);
    return () => clearTimeout(timer);
  }, [value, paramKey, write]);

  return (
    <div className={cn("relative", className)}>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          // 32 px: a toolbar control, level with the `sm` buttons beside it.
          "h-8 w-full rounded-sm border border-line bg-surface pr-9 pl-3 text-[13px] text-ink transition-colors",
          "placeholder:text-faint hover:border-line-strong focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}

export type FilterOption = { value: string; label: string };

export function FilterSelect({
  paramKey,
  label,
  options,
  className,
}: {
  paramKey: string;
  label: string;
  options: FilterOption[];
  className?: string;
}) {
  const searchParams = useSearchParams();
  const write = useParamWriter();
  const current = searchParams.get(paramKey) ?? "";

  return (
    <Select
      fieldSize="sm"
      aria-label={label}
      value={current}
      onChange={(event) => write({ [paramKey]: event.target.value || null })}
      className={cn("w-full bg-surface", current && "border-brand-line bg-brand-soft", className)}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Filters live in a right-hand `Sheet` (size `sm`) instead of a panel that
 * pushed the table down — the side-panel-for-filters pattern Rocketlane uses
 * everywhere (visual-patterns.md §2). Each `FilterSelect` still writes its own
 * query param immediately, exactly as it did in the old inline panel; the
 * footer's "Aplicar" simply closes the sheet once the URL already reflects the
 * choice, and "Limpar" drops every filter param (keeping `tab`) and closes it.
 */
export function FilterBar({
  children,
  activeCount,
  className,
}: {
  children: React.ReactNode;
  activeCount: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    const tab = params.get("tab");
    const next = new URLSearchParams();
    if (tab) next.set("tab", tab);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant={activeCount > 0 ? "subtle" : "secondary"}
          aria-expanded={open}
          className={className}
        >
          <SlidersHorizontal />
          Filtros
          {activeCount > 0 ? (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent size="sm">
        <SheetHeader
          title="Filtros"
          description={activeCount > 0 ? `${activeCount} ativo(s)` : "Nenhum filtro ativo."}
        />
        <SheetBody className="flex flex-col gap-3">{children}</SheetBody>
        <SheetFooter layout="split">
          <Button variant="secondary" onClick={clear} disabled={activeCount === 0}>
            Limpar
          </Button>
          <Button onClick={() => setOpen(false)}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
