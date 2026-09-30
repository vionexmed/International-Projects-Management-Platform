import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplierFolder } from "@/server/services/regulatory-folders";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { TableShell } from "@/components/ui/table";
import { FolderFiles, ProjectFolderGrid } from "@/features/regulatory/folder-views";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { label } from "@/lib/labels";
import type { SessionUser } from "@/types/auth";

/**
 * Inside a folder: a supplier (its projects as sub-folders, then every file,
 * with what is still owed on top) or one of its projects (its files only).
 */
export async function SupplierFolderView({
  user,
  supplierId,
  projectId,
  locale,
  dict,
}: {
  user: SessionUser;
  supplierId: string;
  projectId?: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const folder = await getSupplierFolder(user, supplierId, projectId);
  if (!folder) notFound();
  const { supplier, project, projects, documents, requests } = folder;
  const supplierHref = `/regulatory?supplier=${supplier.id}`;
  const owed = requests.filter((request) => request.status === "PENDING" || request.status === "REJECTED").length;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Regulatório", href: "/regulatory" },
          project ? { label: supplier.name, href: supplierHref } : { label: supplier.name },
          ...(project ? [{ label: project.name }] : []),
        ]}
        title={project ? project.name : supplier.name}
        description={
          project
            ? [
                project.projectCode,
                `Etapa: ${label.stageKey(project.currentStage, dict)}`,
                `Responsável: ${project.owner.name}`,
                project.targetLaunchDate ? `Lançamento: ${formatDate(project.targetLaunchDate, locale)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : `${supplier.country} · ${projects.length} ${projects.length === 1 ? "projeto" : "projetos"} · ${documents.total} ${documents.total === 1 ? "documento" : "documentos"}`
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={project ? `/projects/${project.id}` : `/suppliers/${supplier.id}`}>
              {project ? "Abrir projeto" : "Ver fornecedor"}
            </Link>
          </Button>
        }
      />

      {!project ? (
        <Section title="Projetos" count={projects.length} className="mb-10">
          <ProjectFolderGrid supplierId={supplier.id} projects={projects} locale={locale} dict={dict} />
        </Section>
      ) : null}

      <Section
        title="Arquivos"
        count={documents.total + owed}
        description={owed > 0 ? `${owed} ${owed === 1 ? "documento ainda não enviado" : "documentos ainda não enviados"}, no topo.` : undefined}
      >
        <TableShell>
          <FolderFiles
            documents={documents.items}
            requests={requests}
            showProject={!project}
            locale={locale}
            dict={dict}
          />
        </TableShell>
        {documents.total > documents.items.length ? (
          <p className="mt-2 text-meta text-muted">
            Mostrando os {documents.items.length} mais recentes.{" "}
            <Link
              href={`/documents?supplier=${supplier.id}${project ? `&project=${project.id}` : ""}`}
              className="font-medium text-brand-strong hover:underline"
            >
              Ver todos em Documentos
            </Link>
          </p>
        ) : null}
      </Section>
    </>
  );
}
