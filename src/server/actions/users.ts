"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { createUser, updateUser } from "@/server/services/users";
import {
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

const ROLES = [
  "ADMIN", "MANAGER", "REGULATORY", "IMPORT", "MARKETING", "VIEWER",
  "SUPPLIER_ADMIN", "SUPPLIER_USER",
] as const;
const LANGUAGES = ["PT_BR", "EN", "ZH"] as const;

const baseSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  role: z.enum(ROLES),
  jobTitle: optionalText,
  department: optionalText,
  language: z.enum(LANGUAGES).default("PT_BR"),
  supplierId: optionalText,
});

export async function inviteTeamMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requirePermission("user:manage");
    const input = parseForm(baseSchema, formData);
    const user = await createUser(actor, { ...input, supplierId: null });

    revalidatePath("/team");
    return { ok: true, createdId: user.id };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Adding a user to a supplier. Admins may target any supplier; a supplier
 * admin may only ever target their own — enforced again in the service.
 */
export async function addSupplierUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requirePermission("portal:manage-users");
    const input = parseForm(
      baseSchema.extend({
        supplierId: z.string().min(1, "Selecione um fornecedor."),
        role: z.enum(["SUPPLIER_ADMIN", "SUPPLIER_USER"]),
        language: z.enum(LANGUAGES).default("EN"),
      }),
      formData,
    );

    const user = await createUser(actor, input);

    revalidatePath(`/suppliers/${input.supplierId}`);
    return { ok: true, createdId: user.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requirePermission("user:manage");
    const { userId, ...input } = parseForm(
      z.object({
        userId: z.string().min(1),
        name: z.string().trim().min(2).max(120).optional(),
        role: z.enum(ROLES).optional(),
        jobTitle: optionalText,
        department: optionalText,
        status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
        language: z.enum(LANGUAGES).optional(),
      }),
      formData,
    );

    await updateUser(actor, userId, input);

    revalidatePath("/team");
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
