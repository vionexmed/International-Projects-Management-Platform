import Link from "next/link";
import { Download, FileText, History } from "lucide-react";
import type { DocumentStatus, DocumentType, DocumentVisibility } from "@/generated/prisma";
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
import { formatDate, formatFileSize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";

export type DocumentRow = {
  id: string;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
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
            <TH>Documento</TH>
            {showProject ? <TH>Projeto</TH> : null}
            <TH>Fornecedor</TH>
            <TH>Tipo</TH>
            <TH>Versão</TH>
            <TH>Enviado por</TH>
            <TH>Data</TH>
            <TH>Status</TH>
            <TH className="w-px" />
          </TR>
        </THead>
        <TBody>
          {documents.map((document) => {
            const status = meta.document(document.status, dict);
            return (
              <TR key={document.id} interactive>
                <TD>
                  <CellStack
                    title={document.name}
                    subtitle={
                      <span className="inline-flex items-center gap-2">
                        {document.currentVersion?.fileName}
                        {document.currentVersion
                          ? ` · ${formatFileSize(document.currentVersion.fileSize)}`
                          : null}
                        {document.visibility === "SHARED_WITH_SUPPLIER" ? (
                          <span className="rounded-xs bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                            Compartilhado
                          </span>
                        ) : null}
                      </span>
                    }
                  />
                </TD>

                {showProject ? (
                  <TD label="Projeto" className="text-[13px]">
                    <Link
                      href={`/projects/${document.project.id}/documents`}
                      className="text-ink-soft hover:text-brand-strong hover:underline"
                    >
                      {document.project.name}
                    </Link>
                  </TD>
                ) : null}

                <TD label="Fornecedor" className="text-[13px] text-ink-soft">{document.supplier?.name ?? "—"}</TD>
                <TD label="Tipo" className="text-[13px] text-ink-soft">
                  {label.documentType(document.type, dict)}
                </TD>
                <TD label="Versão" className="text-[13px] text-ink-soft">
                  {document.currentVersion ? (
                    <span className="inline-flex items-center gap-1.5">
                      v{document.currentVersion.version}
                      {document._count.versions > 1 ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-[12px] text-muted"
                          title={`${document._count.versions} versões`}
                        >
                          <History className="size-3" />
                          {document._count.versions}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD label="Enviado por" className="text-[13px] text-ink-soft">{document.createdBy.name}</TD>
                <TD label="Data" className="text-[13px] whitespace-nowrap text-ink-soft">
                  {formatDate(document.updatedAt, locale)}
                </TD>
                <TD label="Status">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </TD>
                <TD className="text-right max-md:mt-3">
                  {document.currentVersion ? (
                    <a
                      href={`/api/files/${document.currentVersion.id}`}
                      className="relative z-10 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
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
