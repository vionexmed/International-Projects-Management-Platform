import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { getSupplierProfile, type SupplierStatus } from "@/server/services/suppliers";
import type { ProjectStatus } from "@/server/services/projects";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/ui/section";
import { SummaryLine } from "@/components/ui/stat";
import { SolidBadge, StatusBadge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { AddSupplierUserDialog } from "@/features/suppliers/add-supplier-user-dialog";
import { EditSupplierDialog } from "@/features/suppliers/edit-supplier-dialog";
import { CanvasEmpty, CanvasList, CanvasRow } from "@/features/projects/canvas-list";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDateShort } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const user = await requireInternalUser();
  const profile = await getSupplierProfile(user, supplierId);
  return { title: profile?.supplier.name ?? "Fornecedor" };
}

/**
 * "What is the state of this supplier?"
 *
 * The contact details are the record header; the workload is one sentence
 * under it, each number leading to the canonical list already filtered. The
 * body is two short lists on the canvas — the projects preview and the portal
 * accounts — instead of a box of fields, a stat strip and two more boxes.
 */
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
  const status = meta.supplier(supplier.status as SupplierStatus, dict);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Fornecedores", href: "/suppliers" }]}
        title={supplier.name}
        status={<SolidBadge tone={status.tone}>{status.label}</SolidBadge>}
        meta={supplier.country}
        properties={[
          { label: "Contato principal", value: supplier.primaryContact },
          {
            label: "E-mail",
            value: supplier.email ? (
              <a href={`mailto:${supplier.email}`} className="text-brand-strong hover:underline">
                {supplier.email}
              </a>
            ) : null,
          },
          { label: "Telefone", value: supplier.phone },
          {
            label: "Website",
            value: supplier.website ? (
              <a
                href={supplier.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-brand-strong hover:underline"
              >
                Acessar
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null,
          },
          { label: "Endereço", value: supplier.address },
        ]}
        actions={
          can(user, "supplier:manage") ? (
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
          ) : null
        }
      >
        <SummaryLine
          className="mt-5"
          items={[
            {
              label: projects.length === 1 ? "projeto" : "projetos",
              value: projects.length,
              href: `/projects?supplier=${supplier.id}`,
            },
            {
              label: openTasks === 1 ? "pendência" : "pendências",
              value: openTasks,
              href: `/tasks?waiting=${supplier.id}`,
            },
            {
              label: overdueTasks === 1 ? "atrasada" : "atrasadas",
              value: overdueTasks,
              tone: overdueTasks > 0 ? "risk" : undefined,
              href: `/tasks?waiting=${supplier.id}&tab=OVERDUE`,
            },
            {
              label: documentCount === 1 ? "documento" : "documentos",
              value: documentCount,
              href: `/documents?supplier=${supplier.id}`,
            },
          ]}
        />
      </PageHeader>

      <div className="space-y-10">
        {/*
          A summary, not the portfolio table again. `/projects` is the canonical
          list and already filters by supplier, so this shows the first few and
          hands the rest over with the filter applied.
        */}
        <Section
          title="Projetos"
          count={projects.length || undefined}
          action={
            projects.length > 5
              ? { label: "Ver todos em Projetos", href: `/projects?supplier=${supplier.id}` }
              : null
          }
        >
          {projects.length === 0 ? (
            <CanvasEmpty>Nenhum projeto vinculado.</CanvasEmpty>
          ) : (
            <CanvasList>
              {projects.slice(0, 5).map((project) => {
                const projectStatus = meta.project(project.status as ProjectStatus, dict);
                return (
                  <CanvasRow
                    key={project.id}
                    href={`/projects/${project.id}`}
                    title={project.name}
                    subtitle={[
                      project.projectCode,
                      label.stageKey(project.currentStage, dict),
                      project.targetLaunchDate
                        ? `lançamento ${formatDateShort(project.targetLaunchDate, locale)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={
                      <StatusBadge tone={projectStatus.tone}>{projectStatus.label}</StatusBadge>
                    }
                  />
                );
              })}
            </CanvasList>
          )}
        </Section>

        <Section
          title="Usuários do portal"
          count={supplier.users.length || undefined}
          description="Contas com acesso ao Supplier Portal desta empresa."
          action={
            can(user, "portal:manage-users") ? (
              <AddSupplierUserDialog supplierId={supplier.id} supplierName={supplier.name} />
            ) : null
          }
        >
          {supplier.users.length === 0 ? (
            <CanvasEmpty>Nenhum usuário cadastrado. Crie um acesso para que o fornecedor use o portal.</CanvasEmpty>
          ) : (
            <CanvasList>
              {supplier.users.map((supplierUser) => (
                <CanvasRow
                  key={supplierUser.id}
                  leading={<UserAvatar name={supplierUser.name} size="sm" />}
                  title={supplierUser.name}
                  subtitle={[supplierUser.jobTitle, supplierUser.email].filter(Boolean).join(" · ")}
                  trailing={
                    <span className="text-meta whitespace-nowrap text-muted">
                      {label.role(supplierUser.role, dict)} ·{" "}
                      {dict.enums.userStatus[supplierUser.status]}
                    </span>
                  }
                />
              ))}
            </CanvasList>
          )}
        </Section>
      </div>
    </>
  );
}
