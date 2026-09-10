import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { listSuppliers } from "@/server/services/suppliers";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-filters";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CellStack,
  Table,
  TableFooter,
  TableScroll,
  TableShell,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { NewSupplierDialog } from "@/features/suppliers/new-supplier-dialog";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { meta } from "@/lib/labels";

export const metadata: Metadata = { title: "Fornecedores" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireInternalUser();
  const dict = getDictionary(localeFromLanguage(user.language));

  const suppliers = await listSuppliers(user, { query: params.q });

  return (
    <>
      <PageHeader
        title="Fornecedores"
        description="Fabricantes e parceiros internacionais da Vionex."
        actions={can(user, "supplier:manage") ? <NewSupplierDialog /> : null}
      />

      <div className="mb-5">
        <SearchInput placeholder="Buscar fornecedores…" className="w-full sm:w-80" />
      </div>

      <TableShell>
        {suppliers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={params.q ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor ainda."}
            description={
              params.q
                ? "Ajuste a busca para ver outros resultados."
                : "Cadastre o primeiro fornecedor para vincular projetos e documentos."
            }
          />
        ) : (
          <>
            <TableScroll>
              <Table>
                <THead>
                  <TR>
                    <TH>Fornecedor</TH>
                    <TH>País</TH>
                    <TH>Projetos</TH>
                    <TH>Pendências</TH>
                    <TH>Atrasadas</TH>
                    <TH>Status</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {suppliers.map((supplier) => {
                    const status = meta.supplier(supplier.status, dict);
                    return (
                      <TR key={supplier.id} interactive>
                        <TD>
                          <Link
                            href={`/suppliers/${supplier.id}`}
                            className="block after:absolute after:inset-0 after:content-['']"
                          >
                            <CellStack title={supplier.name} />
                          </Link>
                        </TD>
                        <TD label="País" className="text-[13px] text-ink-soft">{supplier.country}</TD>
                        <TD label="Projetos" className="text-[13px] text-ink-soft tabular-nums">
                          {supplier.projectCount}
                        </TD>
                        <TD label="Pendências" className="text-[13px] text-ink-soft tabular-nums">
                          {supplier.openTaskCount}
                        </TD>
                        <TD label="Atrasadas" className="text-[13px] tabular-nums">
                          {supplier.overdueTaskCount > 0 ? (
                            <span className="font-medium text-risk">{supplier.overdueTaskCount}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </TD>
                        <TD label="Status">
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </TD>
                        <TD className="max-md:hidden text-right">
                          <ChevronRight className="inline size-4 text-faint" />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
            <TableFooter>
              <span>
                {suppliers.length} fornecedor{suppliers.length === 1 ? "" : "es"}
              </span>
            </TableFooter>
          </>
        )}
      </TableShell>
    </>
  );
}
