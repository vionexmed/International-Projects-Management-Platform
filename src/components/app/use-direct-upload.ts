"use client";

import * as React from "react";
import { requestUploadTicketAction } from "@/server/actions/documents";
import { requestAttachmentTicketAction } from "@/server/actions/messages";

/**
 * Sends the file to storage before the form is submitted, when it has to be.
 *
 * The platform refuses any request to a serverless function above roughly
 * 4.5 MB, and it refuses it at the edge — the function never runs, so the
 * application cannot explain what happened. That is the error people were
 * getting: a blank "something went wrong" for a perfectly ordinary 5 MB PDF.
 *
 * So the file takes a different road. The server approves it and returns a
 * short-lived URL for one object; the browser uploads straight there; the form
 * then carries a signed receipt instead of the bytes. The request that reaches
 * the server is a few hundred bytes whatever the file weighs.
 *
 * Small files keep going the old way. It is one fewer round trip, it works
 * with no bucket at all in local development, and the threshold is deliberately
 * well below the platform's so nothing sits near the edge of it.
 */

/** Files at or above this go direct. Comfortably under the 4.5 MB ceiling. */
const DIRECT_UPLOAD_THRESHOLD = 3 * 1024 * 1024;

/** Whether `prepare` will send this file straight to storage. */
export function needsDirectUpload(file: File) {
  return file.size >= DIRECT_UPLOAD_THRESHOLD;
}

export type UploadPreparation =
  | { ok: true; token: string | null }
  | { ok: false; error: string };

/**
 * Wording for the two failures the browser can see for itself. Optional so the
 * internal screens keep theirs; `{status}` is the HTTP status from storage.
 */
export type DirectUploadMessages = {
  connectionFailed?: string;
  storageRefused?: string;
};

type TicketResult =
  | { ok: true; url: string | null; token: string; contentType: string }
  | { ok: false; error: string };

type DescribedFile = { fileName: string; contentType: string; size: number };

/**
 * Who approves the upload. A document is approved for a project; a message
 * attachment for a conversation, so the ticket is bound to that thread.
 */
const TICKET_REQUESTERS = {
  document: (projectId: string, file: DescribedFile): Promise<TicketResult> =>
    requestUploadTicketAction({ projectId, ...file }),
  attachment: (threadId: string, file: DescribedFile): Promise<TicketResult> =>
    requestAttachmentTicketAction({ threadId, ...file }),
};

export function useDirectUpload(
  messages: DirectUploadMessages = {},
  kind: keyof typeof TICKET_REQUESTERS = "document",
) {
  const [progress, setProgress] = React.useState<number | null>(null);
  const { connectionFailed, storageRefused } = messages;

  /**
   * Returns a token when the file was uploaded directly, or `null` when the
   * caller should just submit the file with the form. `target` is the project
   * for a document and the thread for an attachment.
   */
  const prepare = React.useCallback(
    async (file: File, target: string): Promise<UploadPreparation> => {
      if (!needsDirectUpload(file)) return { ok: true, token: null };

      setProgress(0);
      try {
        const ticket = await TICKET_REQUESTERS[kind](target, {
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        });

        if (!ticket.ok) return { ok: false, error: ticket.error };

        // No presigned URL — local driver. Fall back to the in-band path.
        if (!ticket.url) return { ok: true, token: null };

        await putWithProgress(ticket.url, file, ticket.contentType, setProgress, {
          connectionFailed,
          storageRefused,
        });
        return { ok: true, token: ticket.token };
      } catch (error) {
        /**
         * The real reason, not a paraphrase of it.
         *
         * This used to say "check your connection" for every failure, which
         * made a perfectly diagnosable 403 or 413 indistinguishable from a
         * dropped wifi — and left the person with nothing to report and us
         * with nothing to debug.
         */
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Falha desconhecida no envio.",
        };
      } finally {
        setProgress(null);
      }
    },
    [connectionFailed, storageRefused, kind],
  );

  return { prepare, progress };
}

/**
 * `XMLHttpRequest` rather than `fetch`, for the one thing it still does better:
 * telling the person how far along a 25 MB upload is. A progress bar is not
 * decoration here — without it a slow connection looks like a frozen dialog.
 */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (value: number) => void,
  messages: DirectUploadMessages,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    request.setRequestHeader("Content-Type", contentType);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) return resolve();

      // The body of a storage error is XML and says exactly what went wrong;
      // the first line of it is worth more than any wording we could invent.
      const detail = (request.responseText || "").replace(/<[^>]+>/g, " ").trim().slice(0, 200);
      if (messages.storageRefused) {
        // The storage's own words stay available to whoever debugs it.
        if (detail) console.error("[upload] storage refused the file:", detail);
        return reject(
          new Error(messages.storageRefused.replace("{status}", String(request.status))),
        );
      }
      reject(
        new Error(
          `O armazenamento recusou o arquivo (HTTP ${request.status})${detail ? `: ${detail}` : "."}`,
        ),
      );
    });
    request.addEventListener("error", () =>
      reject(
        new Error(
          messages.connectionFailed ??
            "A conexão com o armazenamento falhou antes de o envio terminar.",
        ),
      ),
    );
    request.addEventListener("abort", () => reject(new Error("Envio cancelado.")));

    request.send(file);
  });
}
