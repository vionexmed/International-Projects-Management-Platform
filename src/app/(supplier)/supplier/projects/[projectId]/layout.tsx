import { requireSupplierUser } from "@/server/auth/current-user";
import { requireSharedProjectAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { PageHeader } from "@/components/app/page-header";
import { trailLabels } from "@/components/app/trail-labels";
import { SolidBadge } from "@/components/ui/badge";
import { SupplierProjectTabs } from "@/features/supplier-portal/supplier-project-tabs";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import type { ProjectStatus } from "@/server/services/projects";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const user = await requireSupplierUser();
    const project = await requireSharedProjectAccess(user, projectId);
    return { title: project.name };
  } catch {
    return { title: "Project" };
  }
}

/**
 * Access check for the whole supplier project area. A project belonging to
 * another supplier resolves to a 404 rather than a permission error, so the
 * portal never confirms that the record exists.
 */
export default async function SupplierProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireSupplierUser();

  const project = await orNotFound(requireSharedProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const status = meta.project(project.status as ProjectStatus, dict);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: dict.nav.projects, href: "/supplier/projects" }]}
        trailLabels={trailLabels(locale, dict.common.back)}
        title={project.name}
        status={<SolidBadge tone={status.tone}>{status.label}</SolidBadge>}
        properties={[
          { label: dict.common.stage, value: label.stageKey(project.currentStage, dict) },
          { label: dict.common.targetLaunch, value: formatDate(project.targetLaunchDate, locale) },
        ]}
        className="mb-6"
      />

      <SupplierProjectTabs projectId={project.id} dict={dict} className="mb-6" />

      {children}
    </>
  );
}
