import type { Language, UserRole } from "@/generated/prisma";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  /** Non-null only for SUPPLIER_ADMIN / SUPPLIER_USER accounts. */
  supplierId: string | null;
  supplierName: string | null;
  jobTitle: string | null;
  department: string | null;
  language: Language;
};

export const SUPPLIER_ROLES: UserRole[] = ["SUPPLIER_ADMIN", "SUPPLIER_USER"];

export function isSupplierRole(role: UserRole) {
  return SUPPLIER_ROLES.includes(role);
}
