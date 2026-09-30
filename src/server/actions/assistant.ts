"use server";

import { requireInternalUser } from "@/server/auth/current-user";
import { answer } from "@/server/services/assistant/answer";
import type { AssistantReply } from "@/lib/assistant/reply";

/**
 * One question to the platform assistant. Internal users only; the answer is
 * built from the asker's own scoped view of the data and changes nothing.
 */
export async function askAssistantAction(question: string): Promise<AssistantReply | { error: string }> {
  const user = await requireInternalUser();
  const text = typeof question === "string" ? question.trim().slice(0, 500) : "";
  if (!text) return { error: "Escreva uma pergunta." };
  try {
    return await answer(user, text);
  } catch (error) {
    console.error("[vionex] assistant failed", error);
    return { error: "Não consegui consultar os dados agora. Tente de novo em instantes." };
  }
}
