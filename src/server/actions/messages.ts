"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { markThreadRead, sendMessage } from "@/server/services/messages";
import { fileSchema } from "@/lib/upload";
import { parseForm, toActionError, type ActionState } from "@/server/actions/utils";

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
      }),
      formData,
    );

    await sendMessage(user, input.threadId, input.body ?? "", input.file ?? null);
    await markThreadRead(user, input.threadId);

    if (input.returnPath?.startsWith("/")) revalidatePath(input.returnPath);
    revalidatePath("/supplier/messages");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
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
