import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { PageHeader } from "@/components/app/page-header";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { ROLE_DESCRIPTIONS, ROLE_PERMISSIONS } from "@/server/authz/permissions";
import { getDictionary } from "@/lib/i18n/dictionary";
import { LOCALE_LABELS, localeFromLanguage } from "@/lib/i18n/config";
import { OPTIONS, label } from "@/lib/labels";
import { ALLOWED_EXTENSIONS, maxUploadMb } from "@/lib/upload";
import { STAGE_ORDER } from "@/server/services/project-health";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Configurações" };

/** Capabilities surfaced in the roles matrix, grouped for readability. */
const MATRIX = [
  { permission: "project:create", label: "Criar projetos" },
  { permission: "project:update", label: "Editar projetos" },
  { permission: "task:create", label: "Criar tarefas" },
  { permission: "document:upload", label: "Enviar documentos" },
  { permission: "document:request", label: "Solicitar documentos" },
  { permission: "document:review", label: "Revisar documentos" },
  { permission: "regulatory:manage", label: "Gerir regulatório" },
  { permission: "import:manage", label: "Gerir importação" },
  { permission: "gtm:manage", label: "Gerir Go-to-Market" },
  { permission: "supplier:manage", label: "Gerir fornecedores" },
  { permission: "report:read", label: "Ver relatórios" },
  { permission: "user:manage", label: "Gerir usuários" },
  { permission: "settings:manage", label: "Configurações" },
] as const;

export default async function SettingsPage() {
  const user = await requireInternalUser();
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);

  const [organization, userCount, supplierCount] = await Promise.all([
    db.organization.findUnique({ where: { id: user.organizationId } }),
    db.user.count({ where: { organizationId: user.organizationId, supplierId: null } }),
    db.supplier.count({ where: { organizationId: user.organizationId } }),
  ]);

  const isAdmin = can(user, "settings:manage");

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Organização, permissões e parâmetros da plataforma."
      />

      <div className="space-y-6">
        {/* Organization */}
        <Panel>
          <PanelHeader title="Organização" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-4">
            <Field label="Nome">{organization?.name ?? "—"}</Field>
            <Field label="Identificador">{organization?.slug ?? "—"}</Field>
            <Field label="Membros internos">{userCount}</Field>
            <Field label="Fornecedores">{supplierCount}</Field>
            <Field label="Criada em">{formatDate(organization?.createdAt, locale)}</Field>
            <Field label="Idioma padrão">{LOCALE_LABELS[locale]}</Field>
          </dl>
        </Panel>

        {/* Users */}
        <Panel>
          <PanelHeader
            title="Usuários"
            description="Contas internas e do Supplier Portal."
            action={
              <div className="flex items-center gap-3 text-[13px]">
                <Link href="/team" className="font-medium text-brand-strong hover:underline">
                  Gerir equipe
                </Link>
                <span className="text-line-strong" aria-hidden>
                  |
                </span>
                <Link href="/suppliers" className="font-medium text-brand-strong hover:underline">
                  Gerir fornecedores
                </Link>
              </div>
            }
          />
          <div className="p-5 text-[13px] text-muted">
            {isAdmin
              ? "Como administrador, você pode convidar membros da equipe e criar acessos ao portal do fornecedor."
              : "Somente administradores podem criar ou alterar usuários."}
          </div>
        </Panel>

        {/* Roles */}
        <Panel>
          <PanelHeader
            title="Papéis e permissões"
            description="Matriz aplicada no servidor em todas as operações."
          />
          <TableScroll>
            <Table stacked={false}>
              <THead>
                <TR>
                  <TH>Permissão</TH>
                  {OPTIONS.internalRoles.map((role) => (
                    <TH key={role} align="center">
                      {label.role(role, dict)}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {MATRIX.map((entry) => (
                  <TR key={entry.permission}>
                    <TD className="text-[13px] text-ink-soft">{entry.label}</TD>
                    {OPTIONS.internalRoles.map((role) => {
                      const allowed = (ROLE_PERMISSIONS[role] as readonly string[]).includes(
                        entry.permission,
                      );
                      return (
                        <TD key={role} className="text-center">
                          {allowed ? (
                            <Check className="inline size-4 text-ok" aria-label="Permitido" />
                          ) : (
                            <Minus className="inline size-4 text-faint" aria-label="Não permitido" />
                          )}
                        </TD>
                      );
                    })}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>

          {/*
            The matrix above answers "may this role review at all". Which
            documents they may review is narrower, and saying so here keeps the
            screen from overstating the capability it just showed a tick for.
          */}
          <div className="border-t border-line px-5 py-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              Revisão por domínio
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Quem revisa um documento é a área a que ele pertence. Regulatório decide certificados,
              IFUs e documentos clínicos e regulatórios; Importação decide documentos de importação;
              Marketing decide materiais comerciais e apresentações. Contratos, NDAs e documentos do
              tipo “Outro” não identificam uma área e ficam restritos a Administrador e Gerente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-line p-5 sm:grid-cols-2">
            {OPTIONS.supplierRoles.map((role) => (
              <div key={role}>
                <p className="text-[13px] font-semibold text-ink">{label.role(role, dict)}</p>
                <p className="mt-0.5 text-[13px] text-muted">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Project stages */}
          <Panel>
            <PanelHeader
              title="Etapas de projeto"
              description="Criadas automaticamente em cada novo projeto."
            />
            <ol className="divide-y divide-line-soft">
              {STAGE_ORDER.map((stage, index) => (
                <li key={stage} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-ink-soft">
                    {index + 1}
                  </span>
                  <span className="text-sm text-ink">{label.stageKey(stage, dict)}</span>
                </li>
              ))}
            </ol>
          </Panel>

          {/* Document types */}
          <Panel>
            <PanelHeader title="Tipos de documento" />
            <div className="flex flex-wrap gap-2 p-5">
              {OPTIONS.documentType.map((type) => (
                <span
                  key={type}
                  className="rounded-sm border border-line bg-subtle px-2.5 py-1 text-[13px] text-ink-soft"
                >
                  {label.documentType(type, dict)}
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Notifications */}
          <Panel>
            <PanelHeader
              title="Notificações"
              description="Eventos que geram notificação dentro da plataforma."
            />
            <ul className="divide-y divide-line-soft text-[13px] text-ink-soft">
              {[
                "Nova tarefa atribuída",
                "Prazo próximo ou vencido",
                "Documento solicitado ao fornecedor",
                "Documento recebido ou revisado",
                "Novo comentário em tarefa",
                "Nova mensagem em projeto",
                "Fornecedor respondeu a uma solicitação",
              ].map((event) => (
                <li key={event} className="px-5 py-2.5">
                  {event}
                </li>
              ))}
            </ul>
          </Panel>

          {/* Security */}
          <Panel>
            <PanelHeader title="Segurança" description="Parâmetros aplicados no servidor." />
            <dl className="space-y-5 p-5">
              <Field label="Sessão">Cookie httpOnly assinado · 8h, ou 30 dias com “manter conectado”</Field>
              <Field label="Senhas">Hash bcrypt com fator de custo 12</Field>
              <Field label="Tamanho máximo de upload">{maxUploadMb()} MB</Field>
              <Field label="Formatos permitidos">{ALLOWED_EXTENSIONS.join(", ")}</Field>
              <Field label="Isolamento de fornecedores">
                Aplicado no servidor em todas as consultas e downloads
              </Field>
              <Field label="Auditoria">
                Todas as ações relevantes são registradas com autor, entidade e data
              </Field>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
