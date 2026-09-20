import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { roleHas } from "@/server/authz/permissions";
import { isSupplierRole } from "@/types/auth";
import { getPortfolioProgress } from "@/server/services/dashboard";
import { listSuppliers } from "@/server/services/suppliers";
import { listDocumentRequests, type RequestStatus } from "@/server/services/documents";
import type { ProjectStatus } from "@/server/services/projects";
import { CSV_BOM, toCsv } from "@/lib/csv";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate } from "@/lib/format";

const REPORTS = ["portfolio", "regulatory", "suppliers"] as const;
type ReportKey = (typeof REPORTS)[number];

/** CSV export. Every row passes through the caller's own scope. */
export async function GET(_request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (isSupplierRole(user.role) || !roleHas(user.role, "report:read")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!REPORTS.includes(report as ReportKey)) {
    return NextResponse.json({ error: "Relatório inválido." }, { status: 404 });
  }

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  let csv = "";

  if (report === "portfolio") {
    const projects = await getPortfolioProgress(user);
    csv = toCsv(
      ["Código", "Projeto", "Fornecedor", "País", "Responsável", "Etapa", "Status", "Progresso (%)", "Lançamento"],
      projects.map((project) => [
        project.projectCode,
        project.name,
        project.supplierName,
        project.country,
        project.ownerName,
        label.stageKey(project.currentStage, dict),
        meta.project(project.status as ProjectStatus, dict).label,
        project.progress,
        formatDate(project.targetLaunchDate, locale),
      ]),
    );
  } else if (report === "suppliers") {
    const suppliers = await listSuppliers(user);
    csv = toCsv(
      ["Fornecedor", "País", "Projetos", "Pendências", "Atrasadas", "Status"],
      suppliers.map((supplier) => [
        supplier.name,
        supplier.country,
        supplier.projectCount,
        supplier.openTaskCount,
        supplier.overdueTaskCount,
        meta.supplier(supplier.status, dict).label,
      ]),
    );
  } else {
    const requests = await listDocumentRequests(user);
    csv = toCsv(
      ["Documento", "Projeto", "Fornecedor", "Responsável", "Prazo", "Status", "Enviado em"],
      requests.map((request) => [
        request.title,
        request.project.name,
        request.supplier.name,
        request.requestedBy.name,
        formatDate(request.dueDate, locale),
        meta.request(request.status as RequestStatus, dict).label,
        formatDate(request.submittedAt, locale),
      ]),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(CSV_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vionex-${report}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
