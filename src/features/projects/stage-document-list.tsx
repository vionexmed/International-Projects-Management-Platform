import { Download } from "lucide-react";
import type { Document, DocumentCycleStatus, DocumentType, DocumentVersion } from "@/generated/prisma";
import { StatusBadge } from "@/components/ui/badge";
import { CanvasEmpty, CanvasList, CanvasRow } from "@/features/projects/canvas-list";
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
  if (documents.length === 0) return <CanvasEmpty>{emptyTitle}</CanvasEmpty>;

  return (
    <CanvasList>
      {documents.map((document) => {
        const status = meta.document(document.status as DocumentStatus, dict);
        const version = document.currentVersion;
        return (
          <CanvasRow
            key={document.id}
            title={document.name}
            subtitle={[
              label.documentType(document.type, dict),
              version ? `v${version.version}` : null,
              version ? formatFileSize(version.fileSize) : null,
              formatDateShort(document.updatedAt, locale),
            ]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              <>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                {version ? (
                  <a
                    href={`/api/files/${version.id}`}
                    aria-label={`Baixar ${document.name}`}
                    title="Baixar"
                    className="inline-flex size-8 items-center justify-center rounded-sm text-faint transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Download className="size-4" aria-hidden />
                  </a>
                ) : null}
              </>
            }
          />
        );
      })}
    </CanvasList>
  );
}
