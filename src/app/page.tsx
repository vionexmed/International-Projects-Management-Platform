import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { isSupplierRole } from "@/types/auth";
import { isDemoEnabled } from "@/lib/demo";

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    // A demonstration deployment opens on the account chooser instead of a
    // login form nobody has credentials for.
    redirect(isDemoEnabled() ? "/demo" : "/login");
  }

  redirect(isSupplierRole(user.role) ? "/supplier" : "/dashboard");
}
