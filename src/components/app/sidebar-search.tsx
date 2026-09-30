"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ICONS, useSearchHits, type Hit } from "@/components/app/command-palette";
import { cn } from "@/lib/utils";

const KIND: Record<Hit["kind"], string> = {
  project: "Projeto",
  task: "Tarefa",
  document: "Documento",
  supplier: "Fornecedor",
};

/**
 * Search in the sidebar: a magnifier that opens into a field where it sits.
 * The field grows out of the icon, results drop in beneath it, arrows and
 * Enter move through them; Escape — or leaving it empty — folds it back.
 * ⌘K still opens the full palette.
 */
export function SidebarSearch() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [active, setActive] = React.useState(0);
  const { ready, visible, settled } = useSearchHits(term, () => setActive(0));

  const close = () => {
    setOpen(false);
    setTerm("");
  };

  const go = (hit: Hit) => {
    close();
    router.push(hit.href);
  };

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-8 items-center overflow-hidden rounded-sm transition-[width,background-color] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none",
          open ? "w-full bg-navy-soft ring-1 ring-navy-line" : "w-8 hover:bg-navy-soft",
        )}
      >
        <button
          type="button"
          aria-label="Buscar"
          aria-expanded={open}
          onClick={() => (open ? inputRef.current?.focus() : setOpen(true))}
          className="flex size-8 shrink-0 items-center justify-center text-navy-ink transition-colors hover:text-white"
        >
          <Search className="size-4" />
        </button>
        <input
          ref={inputRef}
          value={term}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          placeholder="Buscar projetos, tarefas…"
          aria-label="Buscar projetos, tarefas, documentos e fornecedores"
          onChange={(event) => setTerm(event.target.value)}
          onBlur={() => {
            // Let a click on a result land before folding away.
            setTimeout(() => {
              if (!inputRef.current?.value) setOpen(false);
            }, 150);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              return;
            }
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
          }}
          className={cn(
            "h-8 min-w-0 flex-1 bg-transparent pr-1 text-[13px] text-white outline-none placeholder:text-navy-ink/70 transition-opacity duration-200",
            open ? "opacity-100 delay-100" : "pointer-events-none opacity-0",
          )}
        />
        {open && term ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setTerm("");
              inputRef.current?.focus();
            }}
            className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-xs text-navy-ink hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {open && ready ? (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-md border border-navy-line bg-navy-soft shadow-overlay data-[state=open]:animate-fade-in">
          {!settled && visible.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-navy-ink">Buscando…</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-navy-ink">Nada encontrado.</p>
          ) : (
            <ul className="scroll-slim max-h-80 overflow-y-auto p-1">
              {visible.map((hit, index) => {
                const Icon = ICONS[hit.kind];
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(hit)}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors",
                        index === active ? "bg-navy-line" : "hover:bg-navy-line/60",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0 text-navy-ink" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-white">{hit.title}</span>
                        <span className="block truncate text-[11px] text-navy-ink">
                          {KIND[hit.kind]} · {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
