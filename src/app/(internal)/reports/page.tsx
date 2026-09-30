import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { listProjectHealth } from "@/server/services/reports";
import { PageHeader } from "@/components/app/page-header";
import { PortfolioReport } from "@/features/reports/portfolio-report";
import { ProjectReport } from "@/features/reports/project-report";
import { SupplierReport } from "@/features/reports/supplier-report";
import { ReportPicker } from "@/features/reports/report-picker";
import { ExportMenu } from "@/features/reports/export-menu";
import { PrintButton } from "@/features/reports/print-button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Relatórios" };

/**
 * Reports read as reports: the portfolio's health first, then — from the
 * "Relatório individual" picker or any row — one project or one company on
 * its own page, printable as a PDF. `?project=` and `?supplier=` keep each
 * report a link that can be sent.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireInternalUser();
  if (!can(user, "report:read")) redirect("/dashboard");

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const params = await searchParams;

  if (params.project) return <ProjectReport user={user} projectId={params.project} locale={locale} dict={dict} />;
  if (params.supplier) return <SupplierReport user={user} supplierId={params.supplier} locale={locale} dict={dict} />;

  const rows = await listProjectHealth(user);
  const suppliers = new Map<string, { id: string; name: string; country: string }>();
  for (const row of rows) suppliers.set(row.supplier.id, row.supplier);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`Saúde do portfólio em ${formatDate(new Date(), locale)}. Cada projeto e cada empresa tem seu relatório.`}
        actions={
          <>
            <ExportMenu />
            <PrintButton />
            <ReportPicker
              projects={rows.map((row) => ({ id: row.id, name: row.name, code: row.projectCode, supplier: row.supplier.name }))}
              suppliers={[...suppliers.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))}
            />
          </>
        }
      />
      <PortfolioReport user={user} rows={rows} locale={locale} dict={dict} />
    </>
  );
}
