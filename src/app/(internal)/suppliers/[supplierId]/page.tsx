import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { getSupplierProfile } from "@/server/services/suppliers";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import { SolidBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/avatar";
import { AddSupplierUserDialog } from "@/features/suppliers/add-supplier-user-dialog";
import { EditSupplierDialog } from "@/features/suppliers/edit-supplier-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const user = await requireInternalUser();
  const profile = await getSupplierProfile(user, supplierId);
  return { title: profile?.supplier.name ?? "Fornecedor" };
}

export default async function SupplierProfilePage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;
  const user = await requireInternalUser();

  const profile = await getSupplierProfile(user, supplierId);
  if (!profile) notFound();

  const { supplier, projects, openTasks, overdueTasks, documentCount } = profile;
  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const status = meta.supplier(supplier.status, dict);

  return (
    <>
      <Link
        href="/suppliers"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Fornecedores
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
              {supplier.name}
            </h1>
            <SolidBadge tone={status.tone}>{status.label}</SolidBadge>
          </div>
          <p className="mt-1.5 text-[14px] text-muted">
            {supplier.country}
            {supplier.primaryContact ? ` · ${supplier.primaryContact}` : ""}
          </p>
        </div>

        {can(user, "supplier:manage") ? (
          <EditSupplierDialog
            supplier={{
              id: supplier.id,
              name: supplier.name,
              country: supplier.country,
              website: supplier.website,
              address: supplier.address,
              primaryContact: supplier.primaryContact,
              email: supplier.email,
              phone: supplier.phone,
              status: supplier.status,
            }}
          />
        ) : null}
      </div>

      <div className="space-y-6">
        <Panel>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="País">{supplier.country}</Field>
            <Field label="Contato principal">{supplier.primaryContact ?? "—"}</Field>
            <Field label="E-mail">
              {supplier.email ? (
                <a href={`mailto:${supplier.email}`} className="text-brand-strong hover:underline">
                  {supplier.email}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Telefone">{supplier.phone ?? "—"}</Field>
            <Field label="Website">
              {supplier.website ? (
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-brand-strong hover:underline"
                >
                  Acessar
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Endereço" className="col-span-2">
              {supplier.address ?? "—"}
            </Field>
          </dl>

          <div className="stat-grid grid grid-cols-2 divide-line border-t border-line sm:grid-cols-4 sm:divide-x">
            <Metric label="Projetos" value={projects.length} />
            <Metric label="Pendências" value={openTasks} />
            <Metric label="Atrasadas" value={overdueTasks} tone={overdueTasks > 0 ? "risk" : undefined} />
            <Metric label="Documentos" value={documentCount} />
          </div>
        </Panel>

        {/*
          A summary, not the portfolio table again. `/projects` is the canonical
          list and already filters by supplier, so this shows the first few and
          hands the rest over with the filter applied.
        */}
        <Panel>
          <PanelHeader
            title="Projetos"
            description={`${projects.length} projeto(s) com este fornecedor.`}
            action={
              projects.length > 0 ? (
                <Link
                  href={`/projects?supplier=${supplier.id}`}
                  className="text-[13px] font-medium text-brand-strong hover:underline"
                >
                  Ver em Projetos
                </Link>
              ) : null
            }
          />
          {projects.length === 0 ? (
            <EmptyState title="Nenhum projeto vinculado." compact />
          ) : (
            <ul className="divide-y divide-line-soft">
              {projects.slice(0, 5).map((project) => {
                const projectStatus = meta.project(project.status, dict);
                return (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-subtle"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{project.name}</p>
                        <p className="mt-0.5 text-[13px] text-muted">
                          {project.projectCode} · {label.stageKey(project.currentStage, dict)} ·{" "}
                          {formatDate(project.targetLaunchDate, locale)}
                        </p>
                      </div>
                      <StatusBadge tone={projectStatus.tone}>{projectStatus.label}</StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Usuários do portal"
            description="Contas com acesso ao Supplier Portal desta empresa."
            action={
              can(user, "portal:manage-users") ? (
                <AddSupplierUserDialog supplierId={supplier.id} supplierName={supplier.name} />
              ) : null
            }
          />
          {supplier.users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum usuário cadastrado."
              description="Crie um acesso para que o fornecedor use o portal."
              compact
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {supplier.users.map((supplierUser) => (
                <li
                  key={supplierUser.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={supplierUser.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{supplierUser.name}</p>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {supplierUser.jobTitle ?? label.role(supplierUser.role, dict)} ·{" "}
                        {supplierUser.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-[13px]">
                    <span className="text-muted">{label.role(supplierUser.role, dict)}</span>
                    <span className="text-muted">{dict.enums.userStatus[supplierUser.status]}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Metric({ label: metricLabel, value, tone }: { label: string; value: number; tone?: "risk" }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        {metricLabel}
      </div>
      <div
        className={`mt-2 text-[24px] leading-none font-semibold tabular-nums ${tone === "risk" ? "text-risk" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}
