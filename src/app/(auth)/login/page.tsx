import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_INTERNAL_LOCALE } from "@/lib/i18n/config";
import { VionexLogo } from "@/components/app/logo";
import { isSupplierRole } from "@/types/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isSupplierRole(user.role) ? "/supplier" : "/dashboard");

  const locale = DEFAULT_INTERNAL_LOCALE;
  const dict = getDictionary(locale);

  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <VionexLogo className="mb-9" />

          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {dict.auth.welcomeBack}
          </h1>
          <p className="mt-1.5 mb-7 text-[14px] text-muted">{dict.auth.signInSubtitle}</p>

          <div className="rounded-lg border border-line bg-surface p-6">
            <LoginForm dict={dict} locale={locale} />
          </div>

          <p className="mt-6 text-center text-[12px] text-faint">
            Vionex Projects · International Projects Management Platform
          </p>
        </div>
      </div>

      <footer className="border-t border-line px-6 py-4 text-center text-[12px] text-faint">
        © {new Date().getFullYear()} Vionex. Todos os direitos reservados.
      </footer>
    </main>
  );
}
