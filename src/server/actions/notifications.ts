"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { markAllRead, markRead } from "@/server/services/notifications";

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

/**
 * Marks one notification read and follows it to its target. Implemented as a
 * form submit so it works without JavaScript, and so the unread badge clears
 * on the way rather than only via "mark all as read".
 */
export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("notificationId") ?? "");
  if (id) await markRead(user.id, id);

  revalidatePath("/notifications");
  revalidatePath("/dashboard");

  // Only same-origin paths, so the form cannot be turned into an open redirect.
  const href = String(formData.get("href") ?? "");
  if (href.startsWith("/") && !href.startsWith("//")) redirect(href);
}
