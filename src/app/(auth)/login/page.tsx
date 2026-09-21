import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_INTERNAL_LOCALE } from "@/lib/i18n/config";
import { VionexLogo, VionexMark } from "@/components/app/logo";
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
        Deliberately almost empty: the name set large in the middle of the
        field, and one line at the foot saying what it is. Nothing here
        argues for the product — the person on this screen already works
        with it and is three seconds from being inside.
      */}
      <aside className="relative hidden overflow-hidden border-l border-navy-line bg-navy px-16 py-14 lg:flex lg:flex-col">
        {/*
          The mark as structure, not decoration: oversized and cropped by the
          panel edge, one step off the background — a shape in the field,
          never a picture asking to be looked at. The title sits over it.
        */}
        <span
          aria-hidden
          className="vx-rise pointer-events-none absolute top-1/2 -right-28 -translate-y-1/2"
          style={{ animationDelay: "120ms" }}
        >
          <VionexMark className="size-[480px] text-navy-line" />
        </span>

        <div className="relative flex flex-1 items-center">
          <div>
            {/*
              Set as type, not as the logo file: the lockup would put the
              mark on screen a second time, and the one behind is the one
              doing the work.
            */}
            <p className="vx-rise text-[44px] leading-none font-semibold tracking-[0.06em] text-white">
              VIONEX
            </p>
            <p
              className="vx-rise mt-4 text-[12.5px] font-medium tracking-[0.32em] text-navy-ink uppercase"
              style={{ animationDelay: "140ms" }}
            >
              International Projects
            </p>
          </div>
        </div>

        <p
          className="vx-rise relative border-t border-navy-line pt-5 text-[14px] leading-[1.6] text-navy-ink"
          style={{ animationDelay: "240ms" }}
        >
          Plataforma de gestão de projetos internacionais.
        </p>
      </aside>
    </main>
  );
}
