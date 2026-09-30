import Link from "next/link";
import { ChevronRight, FileClock, Folder } from "lucide-react";
import type { StageKey } from "@/generated/prisma";
import type { RequestStatus } from "@/server/services/documents";
import type { SupplierFolder } from "@/server/services/regulatory-folders";
import { StatusIcon, type StatusIconKind } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CellStack, Table, TableScroll, TableShell, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDate, formatDateShort } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The folder views of `/regulatory`: supplier folders, the project rows
 * inside one, and the documents still owed. Pure server markup.
 */

const TONE_ICON: Record<Tone, StatusIconKind> = {
  ok: "done",
  warn: "waiting",
  risk: "blocked",
  info: "in-progress",
  neutral: "open",
};

function FolderGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-strong", className)}>
      <Folder className="size-5 fill-brand/15" aria-hidden />
    </span>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The top level: one folder per supplier, as a grid of Drive-like tiles. */
export function SupplierFolderGrid({ folders, locale }: { folders: SupplierFolder[]; locale: Locale }) {
  if (folders.length === 0) {
    return <EmptyState icon={Folder} title="Nenhum fornecedor cadastrado." compact />;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => (
        <li key={folder.id}>
          <Link
            href={`/regulatory?supplier=${folder.id}`}
            className="group flex h-full items-start gap-3 rounded-md border border-line-soft bg-surface p-4 transition-colors hover:border-line-strong hover:bg-subtle"
          >
            <FolderGlyph />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-title text-ink">{folder.name}</span>
                <ChevronRight className="size-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
              <span className="block text-meta text-muted">
                {folder.country}
                {folder.updatedAt ? ` · atualizado em ${formatDateShort(folder.updatedAt, locale)}` : ""}
              </span>
              <span className="mt-2 block text-meta text-ink-soft">
                {plural(folder.projectCount, "projeto", "projetos")} · {plural(folder.documentCount, "documento", "documentos")}
              </span>
              {folder.awaitingSupplier > 0 || folder.awaitingReview > 0 ? (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {folder.awaitingSupplier > 0 ? (
                    <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                      {folder.awaitingSupplier} aguardando envio
                    </span>
                  ) : null}
                  {folder.awaitingReview > 0 ? (
                    <span className="rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info">
                      {folder.awaitingReview} para analisar
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type ProjectFolderRow = {
  id: string;
  name: string;
  projectCode: string;
  currentStage: StageKey;
  targetLaunchDate: Date | null;
  owner: { name: string };
  documentCount: number;
  pending: number;
  updatedAt: Date | null;
};

/** Inside a supplier: each project is a sub-folder row carrying its own facts. */
export function ProjectFolderTable({
  supplierId,
  projects,
  locale,
  dict,
}: {
  supplierId: string;
  projects: ProjectFolderRow[];
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <TableShell>
      {projects.length === 0 ? (
        <EmptyState icon={Folder} title="Nenhum projeto ativo com este fornecedor." compact />
      ) : (
        <TableScroll>
          <Table>
            <THead>
              <TR>
                <TH className="min-w-64">Projeto</TH>
                <TH className="w-px">Etapa atual</TH>
                <TH className="w-px">Responsável</TH>
                <TH className="w-px" align="right">Documentos</TH>
                <TH className="w-px" align="right">Aguardando envio</TH>
                <TH className="w-px" align="right">Lançamento</TH>
              </TR>
            </THead>
            <TBody>
              {projects.map((project) => (
                <TR key={project.id} interactive>
                  <TD>
                    <Link
                      href={`/regulatory?supplier=${supplierId}&project=${project.id}`}
                      className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']"
                    >
                      <FolderGlyph className="size-8" />
                      <CellStack
                        title={project.name}
                        subtitle={`${project.projectCode}${project.updatedAt ? ` · atualizado em ${formatDateShort(project.updatedAt, locale)}` : ""}`}
                      />
                    </Link>
                  </TD>
                  <TD label="Etapa atual">
                    <span className="inline-flex items-center rounded-xs bg-brand-soft px-2 py-1 text-xs font-medium whitespace-nowrap text-brand-deep">
                      {label.stageKey(project.currentStage, dict)}
                    </span>
                  </TD>
                  <TD label="Responsável">{project.owner.name}</TD>
                  <TD label="Documentos" align="right">{project.documentCount}</TD>
                  <TD label="Aguardando envio" align="right" className={cn(project.pending > 0 && "font-medium text-warn")}>
                    {project.pending}
                  </TD>
                  <TD label="Lançamento" align="right">{formatDate(project.targetLaunchDate, locale)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      )}
    </TableShell>
  );
}

export type PendingRequestRow = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  project: { id: string; name: string };
};

/** Requests still open in this folder: the files that should be here and are not yet. */
export function PendingRequests({
  requests,
  showProject,
  locale,
  dict,
}: {
  requests: PendingRequestRow[];
  showProject: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  if (requests.length === 0) return null;
  return (
    <TableShell>
      <TableScroll>
        <Table>
          <THead>
            <TR>
              <TH className="min-w-64">Solicitação</TH>
              {showProject ? <TH className="w-px">Projeto</TH> : null}
              <TH className="w-px">Status</TH>
              <TH className="w-px" align="right">Prazo</TH>
            </TR>
          </THead>
          <TBody>
            {requests.map((request) => {
              const status = meta.request(request.status as RequestStatus, dict);
              const remaining = daysUntil(request.dueDate);
              const late = remaining !== null && remaining < 0 && ["PENDING", "REJECTED"].includes(request.status);
              return (
                <TR key={request.id} interactive>
                  <TD>
                    <Link
                      href={`/projects/${request.project.id}/regulatory`}
                      className="flex items-center gap-3 after:absolute after:inset-0 after:content-['']"
                    >
                      <FileClock className="size-4 shrink-0 text-faint" aria-hidden />
                      <CellStack title={request.title} />
                    </Link>
                  </TD>
                  {showProject ? <TD label="Projeto">{request.project.name}</TD> : null}
                  <TD label="Status">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <StatusIcon kind={TONE_ICON[status.tone]} tone={status.tone} />
                      {status.label}
                    </span>
                  </TD>
                  <TD label="Prazo" align="right" className={cn(late && "font-medium text-risk")}>
                    {request.dueDate ? formatDateShort(request.dueDate, locale) : "—"}
                    {late ? " · atrasado" : ""}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableScroll>
    </TableShell>
  );
}
