import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck, TriangleAlert } from "lucide-react";
import { VionexLogo } from "@/components/app/logo";
import { Panel } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { isDemoEnabled, isPublicDemo } from "@/lib/demo";

/**
 * Rendered per request, never prerendered: DEMO_MODE is read at runtime, so a
 * page baked at build time would freeze whatever the flag was during the
 * build and ignore the deployment's actual setting.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Escolher acesso",
  robots: { index: false, follow: false },
};

/**
 * Entry point for a demonstration deployment: pick an account and go straight
 * into the corresponding environment, with no password.
 *
 * Every account below produces a *real* session, so roles, permissions and the
 * isolation between suppliers behave exactly as in production — the only thing
 * skipped is typing the password.
 */
const INTERNAL = [
  { key: "admin", name: "Lucas Silva", role: "Administrador", note: "Acesso total à plataforma" },
  { key: "regulatory", name: "Stefany Rocha", role: "Regulatório", note: "Áreas regulatória e clínica" },
  { key: "manager", name: "João Mendes", role: "Gestor", note: "Portfólio e fornecedores" },
  { key: "marketing", name: "Maria Santos", role: "Marketing", note: "Go-to-Market" },
  { key: "viewer", name: "Paulo Reis", role: "Visualizador", note: "Somente leitura" },
];

const SUPPLIERS = [
  { key: "emily", name: "Emily Carter", role: "Manufacturer C · Estados Unidos", note: "Só enxerga os projetos da C" },
  { key: "supplier", name: "John Smith", role: "Manufacturer A", note: "Tem solicitações pendentes" },
  { key: "klaus", name: "Klaus Weber", role: "Manufacturer B · Alemanha", note: "Só enxerga os projetos da B" },
];

export default function DemoPage() {
  if (!isDemoEnabled()) notFound();

  return (
    <main className="min-h-dvh bg-canvas px-5 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <VionexLogo className="mb-8" />

        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">
          Vionex Projects
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          A plataforma tem dois ambientes sobre a mesma base de dados. Escolha um acesso abaixo
          para entrar direto, sem senha — os papéis, as permissões e o isolamento entre
          fornecedores funcionam exatamente como em produção.
        </p>

        {isPublicDemo() ? (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-warn/25 bg-warn-soft px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="text-[13px] leading-relaxed text-warn">
              <strong className="font-semibold">Ambiente de demonstração.</strong> O acesso sem
              senha está ligado e os dados são fictícios. Não use este endereço com dados reais
              de fornecedores.
            </p>
          </div>
        ) : null}

        <div className="mt-9 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted" />
              <h2 className="text-[15px] font-semibold text-ink">Vionex Internal</h2>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              O que a equipe Vionex usa: portfólio, tarefas, documentos, regulatório e
              relatórios. Em português.
            </p>
            <Panel className="overflow-hidden">
              <ul className="divide-y divide-line-soft">
                {INTERNAL.map((account) => (
                  <li key={account.key}>
                    <a
                      href={`/demo/enter?as=${account.key}`}
                      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle"
                    >
                      <UserAvatar name={account.name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {account.name}
                        </span>
                        <span className="block truncate text-[13px] text-muted">
                          {account.role} · {account.note}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-faint" />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="size-4 text-muted" />
              <h2 className="text-[15px] font-semibold text-ink">Supplier Portal</h2>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              O que o fabricante vê: só os projetos da própria empresa, o que precisa responder
              e os documentos compartilhados. Em inglês.
            </p>
            <Panel className="overflow-hidden">
              <ul className="divide-y divide-line-soft">
                {SUPPLIERS.map((account) => (
                  <li key={account.key}>
                    <a
                      href={`/demo/enter?as=${account.key}`}
                      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle"
                    >
                      <UserAvatar name={account.name} size="md" tone="brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {account.name}
                        </span>
                        <span className="block truncate text-[13px] text-muted">
                          {account.role} · {account.note}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-faint" />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        </div>

        <p className="mt-8 text-[13px] text-muted">
          Para ver o isolamento na prática: entre como <strong className="font-medium text-ink-soft">Emily
          Carter</strong> e anote os projetos, depois entre como <strong className="font-medium text-ink-soft">Klaus
          Weber</strong> — nenhum dos dois enxerga nada do outro.
        </p>

        <p className="mt-2 text-[13px] text-muted">
          Prefere testar o login real?{" "}
          <a href="/login" className="text-brand-strong hover:underline">
            Acessar a tela de login
          </a>
          .
        </p>
      </div>
    </main>
  );
}
