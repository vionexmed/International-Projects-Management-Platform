"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { recordAudit } from "@/server/services/audit";
import { parseForm, toActionError, type ActionState } from "@/server/actions/utils";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z
      .string()
      .min(8, "A nova senha deve ter ao menos 8 caracteres.")
      .max(200),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "A nova senha deve ser diferente da atual.",
    path: ["newPassword"],
  });

/**
 * Editing one's own profile.
 *
 * Deliberately narrow: name and job title, and nothing else. Everything that
 * decides *what a person can reach* — organisation, supplier, role, status —
 * is absent from the schema, so no request can carry it and no mistake here
 * can widen anybody's access. A person may correct how they are named; who
 * they are is not theirs to edit.
 */
export async function updateOwnProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const input = parseForm(
      z.object({
        name: z.string().trim().min(2, "Informe o nome.").max(120),
        jobTitle: z
          .string()
          .trim()
          .max(120)
          .optional()
          .transform((value) => (value && value.length > 0 ? value : null)),
      }),
      formData,
    );

    await db.user.update({
      where: { id: user.id },
      data: { name: input.name, jobTitle: input.jobTitle },
    });

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "user.update",
      entity: "User",
      entityId: user.id,
      metadata: { fields: ["name", "jobTitle"], self: true },
    });

    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Lets any user rotate their own password. The current password is always
 * re-verified, so a borrowed session cannot lock the real owner out.
 */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const input = parseForm(schema, formData);

    const record = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(input.currentPassword, record.passwordHash))) {
      return { error: "Senha atual incorreta.", fieldErrors: { currentPassword: ["Senha atual incorreta."] } };
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "user.update",
      entity: "User",
      entityId: user.id,
      metadata: { field: "password" },
    });

    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
