import { Download, FileText } from "lucide-react";
import type { Document, DocumentCycleStatus, DocumentType, DocumentVersion } from "@/generated/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatFileSize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label, meta } from "@/lib/labels";
import type { DocumentStatus } from "@/server/services/documents";

export type StageDocument = Pick<Document, "id" | "name" | "updatedAt"> & {
  type: DocumentType;
  // The raw column type: every caller here queries `Document` directly.
  status: DocumentCycleStatus;
  currentVersion: DocumentVersion | null;
  createdBy: { name: string };
};

/**
 * Files are always reached through the authenticated download route — the
 * storage key is never exposed to the browser.
 */
export function StageDocumentList({
  documents,
  locale,
  dict,
  emptyTitle = "Nenhum documento nesta etapa.",
}: {
  documents: StageDocument[];
  locale: Locale;
  dict: Dictionary;
  emptyTitle?: string;
}) {
  if (documents.length === 0) {
    return <EmptyState icon={FileText} title={emptyTitle} compact />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {documents.map((document) => {
        const status = meta.document(document.status as DocumentStatus, dict);
        return (
          <li
            key={document.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FileText className="size-4 shrink-0 text-faint" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{document.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {label.documentType(document.type, dict)}
                  {document.currentVersion ? ` · v${document.currentVersion.version}` : ""}
                  {document.currentVersion
                    ? ` · ${formatFileSize(document.currentVersion.fileSize)}`
                    : ""}{" "}
                  · {formatDate(document.updatedAt, locale)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              {document.currentVersion ? (
                <a
                  href={`/api/files/${document.currentVersion.id}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
                >
                  <Download className="size-3.5" />
                  Baixar
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
