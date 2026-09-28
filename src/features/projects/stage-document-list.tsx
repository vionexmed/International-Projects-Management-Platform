import { Download, FileText } from "lucide-react";
import type { Document, DocumentCycleStatus, DocumentType, DocumentVersion } from "@/generated/prisma";
import { StatusBadge } from "@/components/ui/badge";
import { DenseEmpty, DenseList, DenseRow } from "@/features/projects/work-block";
import { formatDateShort, formatFileSize } from "@/lib/format";
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
  if (documents.length === 0) return <DenseEmpty>{emptyTitle}</DenseEmpty>;

  return (
    <DenseList>
      {documents.map((document) => {
        const status = meta.document(document.status as DocumentStatus, dict);
        const version = document.currentVersion;
        return (
          <DenseRow
            key={document.id}
            leading={<FileText className="size-4 text-faint" aria-hidden />}
            title={document.name}
            meta={[
              label.documentType(document.type, dict),
              version ? `v${version.version}` : null,
              version ? formatFileSize(version.fileSize) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              <>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                <span className="hidden w-12 text-right tabular-nums sm:inline">
                  {formatDateShort(document.updatedAt, locale)}
                </span>
                {version ? (
                  <a
                    href={`/api/files/${version.id}`}
                    aria-label={`Baixar ${document.name}`}
                    title="Baixar"
                    className="inline-flex size-7 items-center justify-center rounded-sm text-faint transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Download className="size-4" aria-hidden />
                  </a>
                ) : (
                  <span className="size-7" aria-hidden />
                )}
              </>
            }
          />
        );
      })}
    </DenseList>
  );
}
