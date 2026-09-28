import { Ship } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { orNotFound } from "@/server/authz/rsc";
import { PropertyList } from "@/components/ui/card";
import { WorkBlock } from "@/features/projects/work-block";
import { EmptyState } from "@/components/ui/empty-state";
import { ShipmentDialog } from "@/features/projects/shipment-dialog";
import { ShipmentProgress } from "@/features/projects/shipment-progress";
import { StageTaskList } from "@/features/projects/stage-task-list";
import { StageDocumentList } from "@/features/projects/stage-document-list";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";

const toInput = (value: Date | null) => value?.toISOString().slice(0, 10) ?? "";

export default async function ProjectImportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireInternalUser();
  await orNotFound(requireProjectAccess(user, projectId));

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  const editable = can(user, "import:manage");

  const [shipments, tasks, documents] = await Promise.all([
    db.importShipment.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    db.task.findMany({
      where: { projectId, category: "IMPORT" },
      include: { assignedTo: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    db.document.findMany({
      where: { projectId, type: "IMPORT" },
      include: { currentVersion: true, createdBy: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const openTasks = tasks.filter(
    (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
  ).length;

  return (
    <div className="space-y-6">
      {/*
        A project with parcelled production has more than one shipment, so the
        add button stays in the block header, not only in the empty state.
      */}
      <WorkBlock
        title="Embarques"
        count={shipments.length || undefined}
        action={editable ? <ShipmentDialog projectId={projectId} /> : null}
      >
        {shipments.length === 0 ? (
          <EmptyState
            icon={Ship}
            title="Nenhum embarque cadastrado."
            description="Adicione um embarque para acompanhar produção, trânsito e desembaraço."
            compact
          />
        ) : (
          <div className="divide-y divide-line">
            {shipments.map((shipment) => (
              <div key={shipment.id}>
                <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 pt-3">
                  {/* The current step is marked on the tracker below, not repeated here. */}
                  <h3 className="min-w-0 truncate text-title text-ink">
                    {shipment.reference ?? "Embarque"}
                  </h3>
                  {editable ? (
                    <ShipmentDialog
                      projectId={projectId}
                      values={{
                        id: shipment.id,
                        reference: shipment.reference ?? "",
                        stage: shipment.stage,
                        shippingMethod: shipment.shippingMethod ?? "",
                        carrier: shipment.carrier ?? "",
                        trackingNumber: shipment.trackingNumber ?? "",
                        portOfOrigin: shipment.portOfOrigin ?? "",
                        portOfArrival: shipment.portOfArrival ?? "",
                        etd: toInput(shipment.etd),
                        eta: toInput(shipment.eta),
                        productionNote: shipment.productionNote ?? "",
                        documentsNote: shipment.documentsNote ?? "",
                      }}
                    />
                  ) : null}
                </div>

                <ShipmentProgress current={shipment.stage} dict={dict} />

                <div className="space-y-4 border-t border-line-faint p-4">
                  <PropertyList
                    layout="grid"
                    items={[
                      { label: "Modal", value: shipment.shippingMethod },
                      { label: "Transportadora", value: shipment.carrier },
                      {
                        label: "Rastreio",
                        value: shipment.trackingNumber ? (
                          <span className="font-mono">{shipment.trackingNumber}</span>
                        ) : null,
                      },
                      { label: "Porto de origem", value: shipment.portOfOrigin },
                      { label: "Porto de chegada", value: shipment.portOfArrival },
                      { label: "ETD", value: shipment.etd ? formatDate(shipment.etd, locale) : null },
                      { label: "ETA", value: shipment.eta ? formatDate(shipment.eta, locale) : null },
                      {
                        label: "Chegada efetiva",
                        value: shipment.arrivedAt ? formatDate(shipment.arrivedAt, locale) : null,
                      },
                    ]}
                  />

                  {shipment.productionNote || shipment.documentsNote ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {shipment.productionNote ? (
                        <Note label="Produção">{shipment.productionNote}</Note>
                      ) : null}
                      {shipment.documentsNote ? (
                        <Note label="Documentação">{shipment.documentsNote}</Note>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkBlock>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <WorkBlock
          title="Tarefas de importação"
          count={openTasks > 0 ? `${openTasks} em aberto` : undefined}
          action={{ label: "Abrir no plano", href: `/projects/${projectId}/tasks?category=IMPORT` }}
        >
          <StageTaskList tasks={tasks} locale={locale} dict={dict} />
        </WorkBlock>

        <WorkBlock
          title="Documentos de importação"
          count={documents.length || undefined}
          action={{ label: "Ver todos", href: `/projects/${projectId}/documents?type=IMPORT` }}
        >
          <StageDocumentList documents={documents} locale={locale} dict={dict} />
        </WorkBlock>
      </div>
    </div>
  );
}

/** A free-text status note, on the tinted surface. */
function Note({ label: noteLabel, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-line-soft bg-subtle px-3 py-2.5">
      <p className="text-meta text-muted">{noteLabel}</p>
      <p className="mt-1 text-body text-ink-soft">{children}</p>
    </div>
  );
}
