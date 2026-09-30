"use client";

import { Check, ChevronDown, Repeat } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { DEMO_INTERNAL, DEMO_SUPPLIERS, type DemoAccount } from "@/lib/demo-accounts";
import { cn } from "@/lib/utils";

/**
 * "Mudar pessoa": in a demonstration, step into any seeded account from where
 * you are — Vionex or a supplier — without going back to `/demo`. Each entry
 * is the same one-click entry the `/demo` page uses (a full navigation, since
 * it sets the session cookie), and it stays on the host it was opened from.
 * Only rendered when the demo is enabled.
 */
export function DemoSwitcher({ current, variant = "header" }: { current: string; variant?: "header" | "sidebar" | "rail" }) {
  const trigger =
    variant === "rail" ? (
      <button
        type="button"
        aria-label="Mudar pessoa"
        className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 text-navy-ink transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <Repeat className="size-[17px]" />
      </button>
    ) : (
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-dashed font-medium whitespace-nowrap transition-colors",
          variant === "sidebar"
            ? "h-8 w-full border-white/15 px-2.5 text-[12px] text-navy-ink hover:bg-white/[0.05] hover:text-white"
            : "h-9 border-brand/40 bg-brand-soft/60 px-3 text-meta text-brand-deep hover:bg-brand-soft",
        )}
      >
        <Repeat className="size-3.5 shrink-0" aria-hidden />
        <span className={cn(variant === "sidebar" && "flex-1 text-left")}>Mudar pessoa</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </button>
    );

  return (
    <Dropdown>
      {variant === "rail" ? (
        <Tooltip content="Mudar pessoa" side="right">
          <DropdownTrigger asChild>{trigger}</DropdownTrigger>
        </Tooltip>
      ) : (
        <DropdownTrigger asChild>{trigger}</DropdownTrigger>
      )}
      <DropdownContent
        side={variant === "header" ? "bottom" : "right"}
        align={variant === "header" ? "end" : "start"}
        className="max-h-[min(560px,calc(100dvh-2rem))] w-80 overflow-y-auto"
      >
        <Group title="Vionex" accounts={DEMO_INTERNAL} current={current} />
        <DropdownSeparator />
        <Group title="Fornecedores" accounts={DEMO_SUPPLIERS} current={current} tone="brand" />
      </DropdownContent>
    </Dropdown>
  );
}

function Group({ title, accounts, current, tone }: { title: string; accounts: DemoAccount[]; current: string; tone?: "brand" }) {
  return (
    <>
      <DropdownLabel>{title}</DropdownLabel>
      {accounts.map((account) => {
        const active = account.name === current;
        return (
          <DropdownItem key={account.key} asChild>
            <a href={`/demo/enter?as=${account.key}`} aria-current={active ? "true" : undefined}>
              <UserAvatar name={account.name} size="sm" tone={tone} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{account.name}</span>
                <span className="block truncate text-meta text-muted">{account.role}</span>
              </span>
              {active ? <Check className="text-brand" aria-label="Conta atual" /> : null}
            </a>
          </DropdownItem>
        );
      })}
    </>
  );
}
