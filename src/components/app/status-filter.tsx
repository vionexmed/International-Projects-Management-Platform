"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/badge";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export type StatusFilterOption = {
  value: string;
  label: string;
  /** Shown inside the menu only — the page shows each number once. */
  count?: number;
  /** A dot for the exceptions (warn/risk); leave the rest plain. */
  tone?: Tone;
};

/**
 * "Status: Todos ▾" — one compact control in the toolbar row, in place of a
 * tab strip (and the KPI cards that repeated its numbers). Each option is a
 * link that writes the same query param the tabs wrote, so the server reads
 * exactly what it read before; the other params are kept, the page resets,
 * and an open task sheet closes.
 *
 * The default option (`defaultValue`) drops the param instead of writing it,
 * as the "Todos" tab did.
 */
export function StatusFilter({
  paramKey,
  options,
  defaultValue,
  label = "Status",
  align = "start",
  className,
}: {
  paramKey: string;
  options: StatusFilterOption[];
  defaultValue: string;
  label?: string;
  align?: "start" | "end";
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? defaultValue;
  const selected = options.find((option) => option.value === current) ?? options[0];
  const filtered = selected.value !== defaultValue;

  const hrefFor = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("task");
    if (value === defaultValue) params.delete(paramKey);
    else params.set(paramKey, value);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button
          size="sm"
          variant={filtered ? "subtle" : "secondary"}
          trailingIcon={<ChevronDown />}
          aria-label={`${label}: ${selected.label}`}
          className={cn("max-w-full", className)}
        >
          <span className="text-muted">{label}:</span>
          <span className="truncate text-ink">{selected.label}</span>
        </Button>
      </DropdownTrigger>
      <DropdownContent align={align} className="min-w-56">
        {options.map((option) => (
          <DropdownItem key={option.value} asChild>
            <Link href={hrefFor(option.value)} scroll={false}>
              {option.tone ? <StatusDot tone={option.tone} /> : <span className="size-[7px] shrink-0" aria-hidden />}
              <span className="flex-1">{option.label}</span>
              {option.count !== undefined ? (
                <span className="text-meta text-faint tabular-nums">{option.count}</span>
              ) : null}
              <Check
                className={cn("text-ink-soft", option.value === selected.value ? "" : "invisible")}
                aria-hidden
              />
            </Link>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
