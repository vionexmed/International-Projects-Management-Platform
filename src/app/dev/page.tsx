import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { VionexLogo } from "@/components/app/logo";
import { Panel } from "@/components/ui/card";

export const metadata: Metadata = { title: "Preview" };

/**
 * DEVELOPMENT ONLY — a directory of the seeded accounts so the UI can be
 * reviewed without typing credentials. Hidden entirely in production.
 */
const INTERNAL = [
  { key: "admin", name: "Lucas Silva", role: "Administrador", note: "Acesso total" },
  { key: "manager", name: "João Mendes", role: "Gestor", note: "Portfólio e fornecedores" },
  { key: "regulatory", name: "Stefany Rocha", role: "Regulatório", note: "Regulatório e clínico" },
  { key: "marketing", name: "Maria Santos", role: "Marketing", note: "Go-to-Market" },
  { key: "viewer", name: "Paulo Reis", role: "Visualizador", note: "Somente leitura" },
];

const SUPPLIERS = [
  { key: "supplier", name: "John Smith", role: "Manufacturer A · China", note: "2 solicitações pendentes" },
  { key: "liwei", name: "Li Wei", role: "Manufacturer A · 中文", note: "Portal em chinês" },
  { key: "klaus", name: "Klaus Weber", role: "Manufacturer B · Alemanha", note: "Só enxerga o Product Beta" },
  { key: "emily", name: "Emily Carter", role: "Manufacturer C · EUA", note: "Só enxerga o Product Gamma" },
];

export default function DevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-dvh bg-canvas px-6 py-14">
      <div className="mx-auto w-full max-w-3xl">
        <VionexLogo className="mb-8" />

        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
          Preview de desenvolvimento
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Entre como qualquer conta de demonstração sem digitar senha. A sessão criada é real —
          papéis, permissões e isolamento entre fornecedores funcionam normalmente.
        </p>

        <div className="mt-4 rounded-sm border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
          Esta página existe apenas em desenvolvimento. Em build de produção ela responde 404.
        </div>

        <section className="mt-9">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <ShieldCheck className="size-4 text-muted" />
            Vionex Internal
          </h2>
          <Panel>
            <ul className="divide-y divide-line-soft">
              {INTERNAL.map((account) => (
                <li key={account.key}>
                  <a
                    href={`/dev/preview?as=${account.key}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-subtle"
                  >
                    <span className="min-w-0">
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

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Building2 className="size-4 text-muted" />
            Supplier Portal
          </h2>
          <Panel>
            <ul className="divide-y divide-line-soft">
              {SUPPLIERS.map((account) => (
                <li key={account.key}>
                  <a
                    href={`/dev/preview?as=${account.key}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-subtle"
                  >
                    <span className="min-w-0">
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

        <p className="mt-8 text-[13px] text-muted">
          Para testar o login de verdade, use{" "}
          <a href="/login" className="text-brand-strong hover:underline">
            /login
          </a>{" "}
          — a senha de todas as contas é <code className="font-mono text-[12px]">vionex123</code>.
        </p>
      </div>
    </main>
  );
}
