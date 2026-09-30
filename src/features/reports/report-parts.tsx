import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { HealthRow } from "@/server/services/reports";
import type { ProjectStatus } from "@/server/services/projects";
import { Table, TableScroll, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDateShort } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Shared pieces of the reports: a health tag, a strip of figures, the
 * project-health table. Written as a report reads — tables and figures,
 * not a grid of cards — and printable as is.
 */

const TAG: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  risk: "bg-risk-soft text-risk",
  info: "bg-info-soft text-info",
  neutral: "bg-raised text-ink-soft",
};

export function HealthTag({ status, dict }: { status: ProjectStatus; dict: Dictionary }) {
  const health = meta.project(status, dict);
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-meta font-medium whitespace-nowrap", TAG[health.tone])}>
      {health.label}
    </span>
  );
}

export type Figure = { label: string; value: React.ReactNode; note?: string; tone?: "risk" | "warn" | "ok" };

/** A row of headline figures, divided by hairlines — one strip, not five cards. */
export function FigureStrip({ figures }: { figures: Figure[] }) {
  return (
    /* Wrapping flex rows: a short last row stretches instead of leaving an empty cell. */
    <dl className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-line-soft bg-line-soft">
      {figures.map((figure) => (
        <div key={figure.label} className="min-w-36 flex-1 basis-36 bg-surface px-5 py-4">
          <dt className="text-meta font-medium text-muted">{figure.label}</dt>
          <dd
            className={cn(
              "mt-1 text-kpi-sm tabular-nums",
              figure.tone === "risk" ? "text-risk" : figure.tone === "warn" ? "text-warn" : figure.tone === "ok" ? "text-ok" : "text-ink",
            )}
          >
            {figure.value}
          </dd>
          {figure.note ? <dd className="mt-0.5 text-meta text-muted">{figure.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** `manual`: the stage's percentage was set by hand, marked with an asterisk the report footnotes. */
export function ProgressCell({ value, manual = false }: { value: number; manual?: boolean }) {
  return (
    <span className="flex w-full max-w-40 items-center gap-2.5">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-meta font-medium text-ink tabular-nums">
        {value}%{manual ? <span className="text-faint" title="Definido manualmente">*</span> : null}
      </span>
    </span>
  );
}

/** Every project with its health and the reason, worst first; each row opens its own report. */
export function HealthTable({ rows, dict, locale, showSupplier = true }: { rows: HealthRow[]; dict: Dictionary; locale: Locale; showSupplier?: boolean }) {
  return (
    <TableShell>
      <TableScroll>
        <Table>
          <THead>
            <TR>
              <TH className="min-w-56">Projeto</TH>
              <TH className="min-w-64">Saúde</TH>
              <TH className="w-px">Etapa</TH>
              <TH className="w-40">Progresso</TH>
              <TH className="w-px" align="right">Atrasadas</TH>
              <TH className="w-px" align="right">Docs pendentes</TH>
              <TH className="w-px" align="right">Lançamento</TH>
              <TH className="w-px print:hidden" />
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id} interactive className="group">
                <TD>
                  <Link href={`/reports?project=${row.id}`} className="block after:absolute after:inset-0">
                    <span className="block font-medium text-ink">{row.name}</span>
                    <span className="block text-meta text-muted">
                      {row.projectCode}
                      {showSupplier ? ` · ${row.supplier.name}` : ""}
                    </span>
                  </Link>
                </TD>
                <TD label="Saúde" className="whitespace-normal">
                  <span className="flex flex-col items-start gap-1">
                    <HealthTag status={row.status as ProjectStatus} dict={dict} />
                    <span className="text-meta text-muted">{row.reason}</span>
                  </span>
                </TD>
                <TD label="Etapa">{label.stageKey(row.currentStage, dict)}</TD>
                <TD label="Progresso">
                  <ProgressCell value={row.progress} />
                </TD>
                <TD label="Atrasadas" align="right" className={cn(row.overdue > 0 && "font-medium text-risk")}>
                  {row.overdue}
                </TD>
                <TD label="Docs pendentes" align="right" className={cn(row.owed > 0 && "font-medium text-warn")}>
                  {row.owed}
                </TD>
                <TD label="Lançamento" align="right">
                  {row.targetLaunchDate ? formatDateShort(row.targetLaunchDate, locale) : "—"}
                </TD>
                <TD className="text-right print:hidden">
                  <span className="inline-flex items-center gap-1 text-meta font-medium text-brand-strong opacity-0 transition-opacity group-hover:opacity-100">
                    Relatório
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableScroll>
    </TableShell>
  );
}
