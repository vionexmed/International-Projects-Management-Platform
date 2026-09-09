import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { isSupplierRole } from "@/types/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(isSupplierRole(user.role) ? "/supplier" : "/dashboard");
}
