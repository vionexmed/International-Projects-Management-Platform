"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
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
          "h-9 w-full rounded-sm border border-line bg-surface pr-9 pl-3 text-sm text-ink",
          "placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none",
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
      aria-label={label}
      value={current}
      onChange={(event) => write({ [paramKey]: event.target.value || null })}
      className={cn("w-auto min-w-36 text-[13px]", current && "border-brand-line bg-brand-soft", className)}
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

/** Collapsible filter row — hidden by default so the page opens calm. */
export function FilterBar({
  children,
  activeCount,
  className,
}: {
  children: React.ReactNode;
  activeCount: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(activeCount > 0);
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
  };

  return (
    <div className={className}>
      <Button
        variant={activeCount > 0 ? "subtle" : "secondary"}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <SlidersHorizontal />
        Filtros
        {activeCount > 0 ? (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-subtle p-3">
          {children}
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clear} className="ml-auto">
              <X />
              Limpar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
