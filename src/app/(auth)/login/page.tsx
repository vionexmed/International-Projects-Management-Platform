import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_INTERNAL_LOCALE } from "@/lib/i18n/config";
import { VionexLogo } from "@/components/app/logo";
import { isSupplierRole } from "@/types/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Two planes meeting at a hairline: the form on white, the product on the
 * same navy the application itself wears, so signing in reads as stepping
 * into the product rather than passing through a gate in front of it.
 *
 * The navy half is `lg` and up only. On a phone it would be a wall of text
 * above the one thing the person came here to do.
 */
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isSupplierRole(user.role) ? "/supplier" : "/dashboard");

  const locale = DEFAULT_INTERNAL_LOCALE;
  const dict = getDictionary(locale);

  return (
    <main className="grid min-h-dvh bg-surface lg:grid-cols-2">
      {/* Form */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
          <VionexLogo />

          <div className="flex flex-1 flex-col justify-center py-12">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.022em] text-ink">
              {dict.auth.welcomeBack}
            </h1>
            <p className="mt-2 mb-8 text-[15px] text-muted">{dict.auth.signInSubtitle}</p>

            <LoginForm dict={dict} locale={locale} />
          </div>

          <p className="text-[12px] text-faint">
            © {new Date().getFullYear()} Vionex. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/*
        Deliberately almost empty: the brand at full voice, and one line
        saying what it is. Nothing here argues for the product — the person
        on this screen already works with it and is three seconds from being
        inside.

        The lockup is the official artwork, which already carries the mark,
        so nothing else does: the oversized mark that used to sit behind
        this was the same symbol printed twice.
      */}
      <aside className="hidden border-l border-navy-line bg-navy px-16 py-14 lg:flex lg:flex-col">
        <div className="flex flex-1 items-center">
          <div className="vx-rise">
            <VionexLogo tone="light" width={380} subtitle={null} />
            <p
              className="vx-rise mt-6 text-[13px] font-medium tracking-[0.3em] text-navy-ink uppercase"
              style={{ animationDelay: "140ms" }}
            >
              International Projects
            </p>
          </div>
        </div>

        <p
          className="vx-rise border-t border-navy-line pt-5 text-[14px] leading-[1.6] text-navy-ink"
          style={{ animationDelay: "240ms" }}
        >
          Plataforma de gestão de projetos internacionais.
        </p>
      </aside>
    </main>
  );
}
