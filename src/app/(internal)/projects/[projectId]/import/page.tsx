import Link from "next/link";
import { Ship } from "lucide-react";
import { requireInternalUser, can } from "@/server/auth/current-user";
import { requireProjectAccess } from "@/server/authz/access";
import { db } from "@/server/db";
import { orNotFound } from "@/server/authz/rsc";
import { Field, Panel, PanelHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShipmentDialog } from "@/features/projects/shipment-dialog";
import { ShipmentProgress } from "@/features/projects/shipment-progress";
import { StageTaskList } from "@/features/projects/stage-task-list";
import { StageDocumentList } from "@/features/projects/stage-document-list";
import { getDictionary } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label } from "@/lib/labels";
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

  return (
    <div className="space-y-6">
      {shipments.length === 0 ? (
        <Panel>
          <PanelHeader
            title="Embarques"
            action={editable ? <ShipmentDialog projectId={projectId} /> : null}
          />
          <EmptyState
            icon={Ship}
            title="Nenhum embarque cadastrado."
            description="Adicione um embarque para acompanhar produção, trânsito e desembaraço."
            compact
          />
        </Panel>
      ) : (
        shipments.map((shipment) => (
          <Panel key={shipment.id}>
            <PanelHeader
              title={shipment.reference ?? "Embarque"}
              description={`Status atual: ${label.shipmentStage(shipment.stage, dict)}`}
              action={
                editable ? (
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
                ) : null
              }
            />

            <div className="border-b border-line">
              <ShipmentProgress current={shipment.stage} dict={dict} />
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Modal">{shipment.shippingMethod ?? "—"}</Field>
              <Field label="Transportadora">{shipment.carrier ?? "—"}</Field>
              <Field label="Rastreio">
                {shipment.trackingNumber ? (
                  <span className="font-mono text-[13px]">{shipment.trackingNumber}</span>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Porto de origem">{shipment.portOfOrigin ?? "—"}</Field>
              <Field label="Porto de chegada">{shipment.portOfArrival ?? "—"}</Field>
              <Field label="ETD">{formatDate(shipment.etd, locale)}</Field>
              <Field label="ETA">{formatDate(shipment.eta, locale)}</Field>
              <Field label="Chegada efetiva">{formatDate(shipment.arrivedAt, locale)}</Field>
            </dl>

            {shipment.productionNote || shipment.documentsNote ? (
              <div className="grid grid-cols-1 gap-5 border-t border-line px-5 py-4 sm:grid-cols-2">
                {shipment.productionNote ? (
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                      Status da produção
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      {shipment.productionNote}
                    </p>
                  </div>
                ) : null}
                {shipment.documentsNote ? (
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                      Status da documentação
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      {shipment.documentsNote}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        ))
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Tarefas de importação"
            action={
              <Link
                href={`/projects/${projectId}/tasks`}
                className="text-[13px] font-medium text-brand-strong hover:underline"
              >
                Ver todas
              </Link>
            }
          />
          <StageTaskList tasks={tasks} locale={locale} dict={dict} />
        </Panel>

        <Panel>
          <PanelHeader title="Documentos de importação" />
          <StageDocumentList documents={documents} locale={locale} dict={dict} />
        </Panel>
      </div>
    </div>
  );
}
