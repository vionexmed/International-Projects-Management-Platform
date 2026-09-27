import Link from "next/link";
import { Download, FileText, Share2 } from "lucide-react";
import type { DocumentCycleStatus, DocumentType, DocumentVisibility } from "@/generated/prisma";
import type { DocumentStatus } from "@/server/services/documents";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { formatDateShort, formatFileSize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";

export type DocumentRow = {
  id: string;
  name: string;
  type: DocumentType;
  // The raw column type: callers pass `listDocuments()` rows unnarrowed.
  status: DocumentCycleStatus;
  visibility: DocumentVisibility;
  updatedAt: Date;
  project: { id: string; name: string; projectCode: string };
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  currentVersion: {
    id: string;
    version: number;
    fileName: string;
    fileSize: number;
    createdAt: Date;
  } | null;
  _count: { versions: number };
};

export function DocumentsTable({
  documents,
  locale,
  dict,
  showProject = true,
  emptyTitle,
  emptyDescription,
}: {
  documents: DocumentRow[];
  locale: Locale;
  dict: Dictionary;
  showProject?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (documents.length === 0) {
    return <EmptyState icon={FileText} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            {/*
              The name column takes the slack (file names are long); the rest
              are as wide as their content, and who-and-when closes the row,
              right-aligned like every date column.
            */}
            <TH className="min-w-64">Documento</TH>
            {showProject ? <TH className="w-px">Projeto</TH> : null}
            <TH className="w-px">Tipo</TH>
            <TH className="w-px">Status</TH>
            <TH className="w-px" align="right">Enviado</TH>
            <TH className="w-px" />
          </TR>
        </THead>
        <TBody>
          {documents.map((document) => {
            const status = meta.document(document.status as DocumentStatus, dict);
            const fileLine = document.currentVersion
              ? `${document.currentVersion.fileName} · v${document.currentVersion.version} · ${formatFileSize(document.currentVersion.fileSize)}`
              : undefined;

            return (
              <TR key={document.id} interactive>
                <TD>
                  <CellStack
                    title={document.name}
                    subtitle={
                      fileLine ? (
                        <span className="inline-flex items-center gap-1.5">
                          {fileLine}
                          {document.visibility === "SHARED_WITH_SUPPLIER" ? (
                            <Share2 className="size-3.5 shrink-0 text-faint">
                              <title>Compartilhado com o fornecedor</title>
                            </Share2>
                          ) : null}
                        </span>
                      ) : undefined
                    }
                  />
                </TD>

                {showProject ? (
                  <TD label="Projeto">
                    <CellStack
                      title={
                        <Link
                          href={`/projects/${document.project.id}/documents`}
                          className="font-normal hover:text-brand-strong hover:underline"
                        >
                          {document.project.name}
                        </Link>
                      }
                      subtitle={document.supplier?.name}
                    />
                  </TD>
                ) : null}

                <TD label="Tipo">{label.documentType(document.type, dict)}</TD>
                <TD label="Status">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </TD>
                <TD label="Enviado" align="right">
                  <CellStack
                    title={<span className="font-normal text-ink-soft">{document.createdBy.name}</span>}
                    subtitle={formatDateShort(document.updatedAt, locale)}
                  />
                </TD>
                <TD className="text-right max-md:mt-3">
                  {document.currentVersion ? (
                    <a
                      href={`/api/files/${document.currentVersion.id}`}
                      className="relative z-10 inline-flex items-center gap-1.5 font-medium text-brand-strong hover:underline"
                      aria-label={`Baixar ${document.name}`}
                    >
                      <Download className="size-3.5" />
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
