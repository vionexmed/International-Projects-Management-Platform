"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { createSupplier, updateSupplier } from "@/server/services/suppliers";
import {
  optionalText,
  parseForm,
  toActionError,
  type ActionState,
} from "@/server/actions/utils";

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do fornecedor.").max(120),
  country: z.string().trim().min(2, "Informe o país."),
  website: optionalText,
  address: optionalText,
  primaryContact: optionalText,
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")).transform((v) => v || null),
  phone: optionalText,
});

export async function createSupplierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("supplier:manage");
    const input = parseForm(supplierSchema, formData);
    const supplier = await createSupplier(user, input);

    revalidatePath("/suppliers");
    return { ok: true, createdId: supplier.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateSupplierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("supplier:manage");
    const { supplierId, ...input } = parseForm(
      supplierSchema.extend({
        supplierId: z.string().min(1),
        status: z.enum(["ON_TRACK", "AT_RISK", "BLOCKED", "INACTIVE"]),
      }),
      formData,
    );

    await updateSupplier(user, supplierId, input);

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${supplierId}`);
    return { ok: true };
  } catch (error) {
    return toActionError(error);
  }
}
