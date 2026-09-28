"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import {
  issueAttachmentTicket,
  markThreadRead,
  sendMessage,
} from "@/server/services/messages";
import { redeemUploadTicket } from "@/server/services/upload-tickets";
import { fileSchema } from "@/lib/upload";
import { errorText } from "@/lib/i18n/error-text";
import { optionalText, parseForm, type ActionState } from "@/server/actions/utils";
import { toCallerActionError } from "@/server/actions/caller-locale";

const ticketSchema = z.object({
  threadId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(200),
  size: z.number(),
});

/**
 * Step one of a large attachment: the same ticket documents use, issued for a
 * conversation the caller can see and bound to it. See `use-direct-upload.ts`.
 */
export async function requestAttachmentTicketAction(input: {
  threadId: string;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<
  | { ok: true; url: string | null; token: string; contentType: string }
  | { ok: false; error: string }
> {
  try {
    const user = await requirePermission("message:send");
    const { threadId, ...file } = ticketSchema.parse(input);
    const ticket = await issueAttachmentTicket(user, threadId, file);
    return { ok: true, url: ticket.url, token: ticket.token, contentType: ticket.contentType };
  } catch (error) {
    const state = await toCallerActionError(error);
    return { ok: false, error: state.error ?? errorText("uploadPrepareFailed") };
  }
}

export async function sendMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("message:send");
    const input = parseForm(
      z.object({
        threadId: z.string().min(1),
        // Empty is allowed when a file comes with it; the service refuses the
        // case where both are missing.
        body: z.string().trim().max(4000).optional(),
        returnPath: z.string().optional(),
        /**
         * Validated by the same rules as every other upload — the allowlist of
         * types and the size ceiling. A message is not a way around them.
         */
        file: fileSchema.optional(),
        /** Receipt of a file that went straight to storage (too big for the request). */
        uploadToken: optionalText,
      }),
      formData,
    );

    /**
     * Redeemed before anything is written: our signature, this session, this
     * thread, and an object storage confirms is there at an allowed size.
     */
    const uploaded = input.uploadToken
      ? await redeemUploadTicket(user, input.uploadToken, { threadId: input.threadId })
      : null;

    await sendMessage(
      user,
      input.threadId,
      input.body ?? "",
      input.file ??
        (uploaded
          ? {
              projectId: uploaded.projectId,
              storageKey: uploaded.key,
              fileName: uploaded.fileName,
              contentType: uploaded.contentType,
              size: uploaded.size,
            }
          : null),
    );
    await markThreadRead(user, input.threadId);

    if (input.returnPath?.startsWith("/")) revalidatePath(input.returnPath);
    revalidatePath("/supplier/messages");
    return { ok: true };
  } catch (error) {
    return toCallerActionError(error);
  }
}

export async function markThreadReadAction(threadId: string) {
  try {
    const user = await requirePermission("message:send");
    await markThreadRead(user, threadId);
  } catch (error) {
    console.error("[messages] mark read failed", error);
  }
}
