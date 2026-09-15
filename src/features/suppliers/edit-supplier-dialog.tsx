"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { updateSupplierAction } from "@/server/actions/suppliers";

export type EditableSupplier = {
  id: string;
  name: string;
  country: string;
  website: string | null;
  address: string | null;
  primaryContact: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

/**
 * Editing a supplier.
 *
 * A manufacturer was immutable after registration: a contact who left the
 * company, a wrong phone number, or a relationship that had gone to `BLOCKED`
 * had no correction anywhere in the product. `updateSupplierAction` was written
 * and audited and simply never reached a screen.
 *
 * The status is the part that matters most. It is what the dashboard reads to
 * decide which suppliers are holding the portfolio up, and until now it could
 * only be set at creation, when nobody yet knows.
 */
const STATUS_OPTIONS = [
  { value: "ON_TRACK", label: "Em dia" },
  { value: "AT_RISK", label: "Em risco" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "INACTIVE", label: "Inativo" },
];

export function EditSupplierDialog({ supplier }: { supplier: EditableSupplier }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <Pencil />
          Editar fornecedor
        </Button>
      }
      title="Editar fornecedor"
      description={supplier.name}
      action={updateSupplierAction}
      submitLabel="Salvar alterações"
      successMessage="Fornecedor atualizado."
      size="lg"
    >
      {(state) => (
        <>
          <input type="hidden" name="supplierId" value={supplier.id} />

          <FieldGrid>
            <Field name="name" label="Nome" required state={state}>
              <Input id="name" name="name" required defaultValue={supplier.name} />
            </Field>
            <Field
              name="country"
              label="País"
              required
              hint="Use o nome em inglês para manter o filtro consistente."
              state={state}
            >
              <Input id="country" name="country" required defaultValue={supplier.country} />
            </Field>
          </FieldGrid>

          <Field
            name="status"
            label="Status"
            hint="Alimenta os gargalos do dashboard."
            state={state}
          >
            <Select id="status" name="status" defaultValue={supplier.status}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <FieldGrid>
            <Field name="primaryContact" label="Contato principal" state={state}>
              <Input
                id="primaryContact"
                name="primaryContact"
                defaultValue={supplier.primaryContact ?? ""}
              />
            </Field>
            <Field name="email" label="E-mail" state={state}>
              <Input id="email" name="email" type="email" defaultValue={supplier.email ?? ""} />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="phone" label="Telefone" hint="Formato internacional: +86 21 5555 0100" state={state}>
              <Input id="phone" name="phone" type="tel" defaultValue={supplier.phone ?? ""} />
            </Field>
            <Field name="website" label="Site" state={state}>
              <Input id="website" name="website" defaultValue={supplier.website ?? ""} />
            </Field>
          </FieldGrid>

          <Field name="address" label="Endereço" state={state}>
            <Textarea id="address" name="address" rows={2} defaultValue={supplier.address ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
