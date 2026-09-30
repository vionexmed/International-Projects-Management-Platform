"use client";

import * as React from "react";
import Link from "next/link";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Building2, ChevronDown, FileText, FolderKanban, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickerProject = { id: string; name: string; code: string; supplier: string };
export type PickerSupplier = { id: string; name: string; country: string };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const ITEM =
  "flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-left text-[13px] text-ink-soft outline-none hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted";

/**
 * "Relatório individual": one searchable list of companies and projects. A
 * pick opens that report; nothing else on the page changes.
 */
export function ReportPicker({ projects, suppliers }: { projects: PickerProject[]; suppliers: PickerSupplier[] }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const q = normalize(query.trim());
  const shownSuppliers = suppliers.filter((supplier) => !q || normalize(`${supplier.name} ${supplier.country}`).includes(q));
  const shownProjects = projects.filter((project) => !q || normalize(`${project.name} ${project.code} ${project.supplier}`).includes(q));
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverPrimitive.Trigger className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand print:hidden [&_svg]:size-4">
        <FileText aria-hidden />
        Relatório individual
        <ChevronDown className="opacity-70" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-80 overflow-hidden rounded-md border border-line bg-surface shadow-overlay data-[state=open]:animate-fade-in"
        >
          <label className="flex h-10 items-center gap-2 border-b border-line-soft px-3">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Empresa ou projeto…"
              aria-label="Buscar empresa ou projeto"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </label>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {shownSuppliers.length > 0 ? (
              <Group title="Empresas">
                {shownSuppliers.map((supplier) => (
                  <Link key={supplier.id} href={`/reports?supplier=${supplier.id}`} onClick={close} className={ITEM}>
                    <Building2 aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{supplier.name}</span>
                    <span className="shrink-0 text-meta text-faint">{supplier.country}</span>
                  </Link>
                ))}
              </Group>
            ) : null}
            {shownProjects.length > 0 ? (
              <Group title="Projetos">
                {shownProjects.map((project) => (
                  <Link key={project.id} href={`/reports?project=${project.id}`} onClick={close} className={ITEM}>
                    <FolderKanban aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    <span className="max-w-24 shrink-0 truncate text-meta text-faint">{project.supplier}</span>
                  </Link>
                ))}
              </Group>
            ) : null}
            {shownSuppliers.length === 0 && shownProjects.length === 0 ? (
              <p className="px-2 py-6 text-center text-meta text-muted">Nada encontrado para “{query}”.</p>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn("pb-1 [&+&]:mt-1 [&+&]:border-t [&+&]:border-line-soft [&+&]:pt-1")}>
      <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">{title}</p>
      {children}
    </div>
  );
}
