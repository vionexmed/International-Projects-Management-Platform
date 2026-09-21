import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
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

      {/* What the person is signing into */}
      <aside className="relative hidden overflow-hidden border-l border-navy-line bg-navy px-16 py-14 lg:flex lg:flex-col lg:justify-center">
        {/*
          The mark as structure, not decoration: oversized, cropped by the
          panel edge and one step off the background. Visible as a shape,
          never as a picture competing with the text.
        */}
        <span aria-hidden className="pointer-events-none absolute -right-24 -bottom-28">
          <VionexMark className="size-[460px] text-navy-soft" />
        </span>

        <div className="relative max-w-[460px]">
          <p className="vx-rise text-[11px] font-medium tracking-[0.18em] text-navy-ink uppercase">
            Vionex Projects
          </p>

          <h2
            className="vx-rise mt-6 text-[31px] leading-[1.2] font-semibold tracking-[-0.022em] text-white"
            style={{ animationDelay: "70ms" }}
          >
            Todo projeto internacional, do primeiro documento ao lançamento.
          </h2>

          <p
            className="vx-rise mt-5 text-[14.5px] leading-[1.65] text-navy-ink"
            style={{ animationDelay: "140ms" }}
          >
            Regulatório, importação, documentos e prazos dos fabricantes na China, Alemanha,
            Estados Unidos e Itália — em um lugar só, com cada fornecedor enxergando apenas o
            que é dele.
          </p>

          <div
            className="vx-rise mt-11 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-navy-line pt-5 text-[11px] font-medium tracking-[0.1em] text-navy-ink uppercase"
            style={{ animationDelay: "210ms" }}
          >
            <span>China</span>
            <Separator />
            <span>Alemanha</span>
            <Separator />
            <span>Estados Unidos</span>
            <Separator />
            <span>Itália</span>
            <ArrowRight className="size-3.5 shrink-0 text-brand" aria-hidden />
            <span className="text-brand">Brasil</span>
          </div>
        </div>
      </aside>
    </main>
  );
}

function Separator() {
  return <span aria-hidden className="size-1 shrink-0 rounded-full bg-navy-line" />;
}
