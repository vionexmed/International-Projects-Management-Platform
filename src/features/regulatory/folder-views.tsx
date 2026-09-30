import Link from "next/link";
import { ChevronRight, Download, FileClock, FileText, Folder } from "lucide-react";
import type { StageKey } from "@/generated/prisma";
import type { DocumentStatus } from "@/server/services/documents";
import type { DocumentRow } from "@/features/documents/documents-table";
import type { SupplierFolder } from "@/server/services/regulatory-folders";
import { EmptyState } from "@/components/ui/empty-state";
import { CellStack, Table, TableScroll, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDateShort, formatFileSize } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The folder views of `/regulatory`: supplier folders, the project rows
 * inside one, and the documents still owed. Pure server markup.
 */


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

/** Inside a supplier: each project is a sub-folder tile carrying its own facts. */
export function ProjectFolderGrid({
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
  if (projects.length === 0) {
    return <EmptyState icon={Folder} title="Nenhum projeto ativo com este fornecedor." compact />;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/regulatory?supplier=${supplierId}&project=${project.id}`}
            className="group flex h-full items-start gap-3 rounded-md border border-line-soft bg-surface p-4 transition-colors hover:border-line-strong hover:bg-subtle"
          >
            <FolderGlyph />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-title text-ink">{project.name}</span>
                <ChevronRight className="size-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
              <span className="block text-meta text-muted">
                {project.projectCode} · {label.stageKey(project.currentStage, dict)}
              </span>
              <span className="mt-2 block text-meta text-ink-soft">
                {plural(project.documentCount, "documento", "documentos")}
                {project.targetLaunchDate ? ` · lançamento ${formatDateShort(project.targetLaunchDate, locale)}` : ""}
              </span>
              {project.pending > 0 ? (
                <span className="mt-2 inline-flex rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                  {project.pending} aguardando envio
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type PendingRequestRow = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  project: { id: string; name: string };
};

const OWED: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Aguardando envio", tone: "bg-warn-soft text-warn" },
  REJECTED: { label: "Correção pedida", tone: "bg-risk-soft text-risk" },
};

const DOC_TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  risk: "bg-risk-soft text-risk",
  info: "bg-info-soft text-info",
  neutral: "bg-raised text-ink-soft",
};

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-meta font-medium whitespace-nowrap", tone)}>{children}</span>;
}

/**
 * The folder's contents, as Drive shows a folder: what is still owed sits on
 * top as dashed placeholder rows (the file that should be there), then every
 * document received, newest first.
 */
export function FolderFiles({
  documents,
  requests,
  showProject,
  locale,
  dict,
}: {
  documents: DocumentRow[];
  requests: PendingRequestRow[];
  showProject: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const owed = requests.filter((request) => request.status in OWED);
  if (owed.length === 0 && documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum arquivo nesta pasta."
        description="Os documentos enviados pelo fornecedor ou pela equipe aparecem aqui."
        compact
      />
    );
  }

  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            <TH className="min-w-72">Nome</TH>
            {showProject ? <TH className="w-px">Projeto</TH> : null}
            <TH className="w-px">Status</TH>
            <TH className="w-px" align="right">Data</TH>
            <TH className="w-px" />
          </TR>
        </THead>
        <TBody>
          {owed.map((request) => {
            const state = OWED[request.status];
            const remaining = daysUntil(request.dueDate);
            const late = remaining !== null && remaining < 0;
            return (
              <TR key={`request-${request.id}`}>
                <TD>
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong text-faint">
                      <FileClock className="size-4" aria-hidden />
                    </span>
                    <CellStack title={<span className="text-ink-soft">{request.title}</span>} subtitle="Solicitado ao fornecedor — ainda não enviado" />
                  </span>
                </TD>
                {showProject ? <TD label="Projeto">{request.project.name}</TD> : null}
                <TD label="Status">
                  <Tag tone={state.tone}>{state.label}</Tag>
                </TD>
                <TD label="Data" align="right" className={cn(late && "font-medium text-risk")}>
                  {request.dueDate ? `prazo ${formatDateShort(request.dueDate, locale)}` : "sem prazo"}
                </TD>
                <TD />
              </TR>
            );
          })}
          {documents.map((document) => {
            const status = meta.document(document.status as DocumentStatus, dict);
            const version = document.currentVersion;
            return (
              <TR key={document.id} interactive>
                <TD>
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-raised text-muted">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <CellStack
                      title={document.name}
                      subtitle={version ? `${version.fileName} · v${version.version} · ${formatFileSize(version.fileSize)}` : label.documentType(document.type, dict)}
                    />
                  </span>
                </TD>
                {showProject ? <TD label="Projeto">{document.project.name}</TD> : null}
                <TD label="Status">
                  <Tag tone={DOC_TONE[status.tone]}>{status.label}</Tag>
                </TD>
                <TD label="Data" align="right">{formatDateShort(document.updatedAt, locale)}</TD>
                <TD className="text-right">
                  {version ? (
                    <a
                      href={`/api/files/${version.id}`}
                      aria-label={`Baixar ${document.name}`}
                      className="relative z-10 inline-flex items-center gap-1.5 font-medium text-brand-strong hover:underline"
                    >
                      <Download className="size-3.5" aria-hidden />
                      Baixar
                    </a>
                  ) : null}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
