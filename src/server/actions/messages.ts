"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { markThreadRead, sendMessage } from "@/server/services/messages";
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
        body: z.string().trim().min(1, "Escreva uma mensagem.").max(4000),
        returnPath: z.string().optional(),
      }),
      formData,
    );

    await sendMessage(user, input.threadId, input.body);
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
