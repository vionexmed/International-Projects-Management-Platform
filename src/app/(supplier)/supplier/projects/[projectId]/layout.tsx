import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { orNotFound } from "@/server/authz/rsc";
import { SolidBadge } from "@/components/ui/badge";
import { SupplierProjectTabs } from "@/features/supplier-portal/supplier-project-tabs";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const user = await requireSupplierUser();
    const project = await requireProjectAccess(user, projectId);
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

  const project = await orNotFound(requireProjectAccess(user, projectId));

  const dict = getDictionary(localeFromLanguage(user.language));
  const status = meta.project(project.status, dict);

  return (
    <>
      <Link
        href="/supplier/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        {dict.nav.projects}
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {project.name}
          </h1>
          <SolidBadge tone={status.tone}>{status.label}</SolidBadge>
        </div>
        <p className="mt-1.5 text-[14px] text-muted">
          {label.stageKey(project.currentStage, dict)}
        </p>
      </div>

      <SupplierProjectTabs projectId={project.id} dict={dict} className="mb-6" />

      {children}
    </>
  );
}
