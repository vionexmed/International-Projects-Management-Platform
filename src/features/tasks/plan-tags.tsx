"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Status/tag columns, as Notion's select: each option is a soft coloured tag.
 * Only the option names are stored, so the colour is derived — first from
 * what the word means (done is green, waiting is amber, late is red), then
 * from its position, so an option keeps its colour from one visit to the next.
 */

export const DEFAULT_STATUS_OPTIONS = ["Pendente", "Em andamento", "Esperando", "Concluído"];

const GREY = "bg-raised text-ink-soft";
const PALETTE = [
  "bg-info-soft text-info",
  "bg-brand-soft text-brand-deep",
  "bg-violet-50 text-violet-700",
  "bg-warn-soft text-warn",
  "bg-ok-soft text-ok",
  "bg-pink-50 text-pink-700",
  "bg-risk-soft text-risk",
  GREY,
];

const MEANING: [RegExp, string][] = [
  [/conclu|feito|pronto|aprovad|finaliz|entregue|done|ok\b/i, "bg-ok-soft text-ok"],
  [/atras|cancel|reprov|recus|bloque|risco|erro|urgente/i, "bg-risk-soft text-risk"],
  [/esper|aguard|pausad|revis|anális|analise|wait/i, "bg-warn-soft text-warn"],
  [/andamento|progresso|fazendo|execu|iniciad/i, "bg-info-soft text-info"],
  [/pendente|a fazer|n[aã]o iniciad|backlog|todo|rascunho/i, GREY],
];

export function tagTone(options: string[], option: string): string {
  const meaning = MEANING.find(([pattern]) => pattern.test(option));
  if (meaning) return meaning[1];
  const index = Math.max(0, options.indexOf(option));
  return PALETTE[index % PALETTE.length];
}

export function PlanTag({ options, option, className }: { options: string[]; option: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center truncate rounded-full px-2.5 text-meta font-medium whitespace-nowrap",
        tagTone(options, option),
        className,
      )}
    >
      {option}
    </span>
  );
}

/**
 * The options of a status column as removable tags, with a field to add one
 * (Enter adds it). Duplicates and blanks are ignored.
 */
export function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const next = draft.trim().slice(0, 80);
    if (!next || options.some((option) => option.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...options, next]);
    setDraft("");
  };

  return (
    <div className="grid gap-2">
      {options.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Opções">
          {options.map((option) => (
            <li key={option}>
              <span className={cn("inline-flex h-6 items-center gap-1 rounded-full pr-1 pl-2.5 text-meta font-medium", tagTone(options, option))}>
                {option}
                <button
                  type="button"
                  aria-label={`Remover opção ${option}`}
                  disabled={disabled}
                  onClick={() => onChange(options.filter((item) => item !== option))}
                  className="inline-flex size-4 items-center justify-center rounded-full opacity-60 hover:bg-black/5 hover:opacity-100"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Nova opção"
          value={draft}
          maxLength={80}
          disabled={disabled}
          placeholder="Nova opção, ex.: Concluído"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-sm border border-line-soft bg-surface px-2.5 text-[13px] text-ink placeholder:text-faint hover:border-line-strong focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
        />
        <button
          type="button"
          aria-label="Adicionar opção"
          disabled={disabled || !draft.trim()}
          onClick={add}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-soft text-muted hover:bg-raised hover:text-ink disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
