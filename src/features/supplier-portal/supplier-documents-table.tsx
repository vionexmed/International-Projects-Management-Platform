import { Download, FileText } from "lucide-react";
import type { DocumentCycleStatus, DocumentType } from "@/generated/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
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
import type { DocumentStatus } from "@/server/services/documents";

export type SupplierDocumentRow = {
  id: string;
  name: string;
  type: DocumentType;
  // The raw column type: callers pass `listDocuments()` rows unnarrowed.
  status: DocumentCycleStatus;
  updatedAt: Date;
  project: { id: string; name: string };
  currentVersion: { id: string; version: number; fileName: string; fileSize: number } | null;
};

/**
 * Only documents explicitly shared with this supplier reach here — the scope
 * is applied in the query, not by hiding rows.
 */
export function SupplierDocumentsTable({
  documents,
  locale,
  dict,
  emptyTitle,
  showProject = true,
}: {
  documents: SupplierDocumentRow[];
  locale: Locale;
  dict: Dictionary;
  emptyTitle: string;
  showProject?: boolean;
}) {
  if (documents.length === 0) {
    return <EmptyState icon={FileText} title={emptyTitle} />;
  }

  return (
    <TableScroll>
      <Table>
        <THead>
          <TR>
            <TH>{dict.portal.documents.title}</TH>
            {showProject ? <TH>{dict.common.project}</TH> : null}
            <TH>{dict.common.type}</TH>
            <TH>{dict.common.version}</TH>
            <TH>{dict.common.date}</TH>
            <TH>{dict.common.status}</TH>
            <TH className="w-px" />
          </TR>
        </THead>
        <TBody>
          {documents.map((document) => {
            const status = meta.document(document.status as DocumentStatus, dict);
            return (
              <TR key={document.id}>
                <TD>
                  <CellStack
                    title={document.name}
                    subtitle={
                      document.currentVersion
                        ? `${document.currentVersion.fileName} · ${formatFileSize(document.currentVersion.fileSize)}`
                        : undefined
                    }
                  />
                </TD>
                {showProject ? (
                  <TD label={dict.common.project} className="text-[13px] text-ink-soft">{document.project.name}</TD>
                ) : null}
                <TD label={dict.common.type} className="text-[13px] text-ink-soft">
                  {label.documentType(document.type, dict)}
                </TD>
                <TD label={dict.common.version} className="text-[13px] text-ink-soft">
                  {document.currentVersion ? `v${document.currentVersion.version}` : "—"}
                </TD>
                <TD label={dict.common.date} className="text-[13px] whitespace-nowrap text-ink-soft">
                  {formatDate(document.updatedAt, locale)}
                </TD>
                <TD label={dict.common.status}>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </TD>
                <TD className="text-right max-md:mt-3">
                  {document.currentVersion ? (
                    <a
                      href={`/api/files/${document.currentVersion.id}`}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
                    >
                      <Download className="size-3.5" />
                      {dict.common.download}
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
