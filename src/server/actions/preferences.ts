"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { languageFromLocale, isLocale } from "@/lib/i18n/config";

/** Lets a user switch the language of their own account only. */
export async function setLanguageAction(formData: FormData) {
  const user = await requireUser();
  const locale = String(formData.get("locale") ?? "");

  const parsed = z.string().refine(isLocale).safeParse(locale);
  if (!parsed.success) return;

  await db.user.update({
    where: { id: user.id },
    data: { language: languageFromLocale(parsed.data) },
  });

  revalidatePath("/supplier", "layout");
  revalidatePath("/dashboard", "layout");
}
