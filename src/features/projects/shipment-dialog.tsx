"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { saveShipmentAction } from "@/server/actions/stages";

export type ShipmentValues = {
  id?: string;
  reference: string;
  stage: string;
  shippingMethod: string;
  carrier: string;
  trackingNumber: string;
  portOfOrigin: string;
  portOfArrival: string;
  etd: string;
  eta: string;
  productionNote: string;
  documentsNote: string;
};

const STAGES = [
  { value: "PRODUCTION", label: "Produção" },
  { value: "READY_FOR_SHIPMENT", label: "Pronto para embarque" },
  { value: "SHIPPED", label: "Embarcado" },
  { value: "IN_TRANSIT", label: "Em trânsito" },
  { value: "ARRIVED", label: "Chegou" },
  { value: "CUSTOMS", label: "Desembaraço" },
  { value: "DELIVERED", label: "Entregue" },
];

export function ShipmentDialog({
  projectId,
  values,
}: {
  projectId: string;
  values?: ShipmentValues;
}) {
  const editing = Boolean(values?.id);

  return (
    <FormDialog
      trigger={
        <Button variant={editing ? "secondary" : "primary"} size="sm">
          {editing ? <Pencil /> : <Plus />}
          {editing ? "Editar embarque" : "Adicionar embarque"}
        </Button>
      }
      title={editing ? "Editar embarque" : "Novo embarque"}
      action={saveShipmentAction}
      submitLabel="Salvar"
      successMessage="Embarque atualizado."
      size="lg"
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={projectId} />
          {values?.id ? <input type="hidden" name="shipmentId" value={values.id} /> : null}

          <FieldGrid>
            <Field name="reference" label="Referência" state={state}>
              <Input id="reference" name="reference" defaultValue={values?.reference ?? ""} />
            </Field>
            <Field name="stage" label="Status do embarque" required state={state}>
              <Select id="stage" name="stage" defaultValue={values?.stage ?? "PRODUCTION"}>
                {STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="shippingMethod" label="Modal" state={state}>
              <Input
                id="shippingMethod"
                name="shippingMethod"
                placeholder="Air freight"
                defaultValue={values?.shippingMethod ?? ""}
              />
            </Field>
            <Field name="carrier" label="Transportadora" state={state}>
              <Input id="carrier" name="carrier" defaultValue={values?.carrier ?? ""} />
            </Field>
          </FieldGrid>

          <Field name="trackingNumber" label="Rastreio" state={state}>
            <Input
              id="trackingNumber"
              name="trackingNumber"
              defaultValue={values?.trackingNumber ?? ""}
            />
          </Field>

          <FieldGrid>
            <Field name="portOfOrigin" label="Porto de origem" state={state}>
              <Input id="portOfOrigin" name="portOfOrigin" defaultValue={values?.portOfOrigin ?? ""} />
            </Field>
            <Field name="portOfArrival" label="Porto de chegada" state={state}>
              <Input
                id="portOfArrival"
                name="portOfArrival"
                defaultValue={values?.portOfArrival ?? ""}
              />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="etd" label="ETD" state={state}>
              <Input id="etd" name="etd" type="date" defaultValue={values?.etd ?? ""} />
            </Field>
            <Field name="eta" label="ETA" state={state}>
              <Input id="eta" name="eta" type="date" defaultValue={values?.eta ?? ""} />
            </Field>
          </FieldGrid>

          <Field name="productionNote" label="Status da produção" state={state}>
            <Textarea
              id="productionNote"
              name="productionNote"
              rows={2}
              defaultValue={values?.productionNote ?? ""}
            />
          </Field>

          <Field name="documentsNote" label="Status da documentação" state={state}>
            <Textarea
              id="documentsNote"
              name="documentsNote"
              rows={2}
              defaultValue={values?.documentsNote ?? ""}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
