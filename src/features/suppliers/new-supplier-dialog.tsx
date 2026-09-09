"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createSupplierAction } from "@/server/actions/suppliers";

export function NewSupplierDialog() {
  return (
    <FormDialog
      trigger={
        <Button variant="primary">
          <Plus />
          Novo fornecedor
        </Button>
      }
      title="Novo fornecedor"
      description="Cadastre o fabricante para vincular projetos, documentos e usuários do portal."
      action={createSupplierAction}
      submitLabel="Cadastrar"
      successMessage="Fornecedor cadastrado."
      redirectTo={(id) => `/suppliers/${id}`}
      size="lg"
    >
      {(state) => (
        <>
          <FieldGrid>
            <Field name="name" label="Empresa" required state={state}>
              <Input id="name" name="name" required placeholder="Manufacturer A" />
            </Field>
            <Field name="country" label="País" required state={state}>
              <Input id="country" name="country" required placeholder="China" />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="primaryContact" label="Contato principal" state={state}>
              <Input id="primaryContact" name="primaryContact" placeholder="John Smith" />
            </Field>
            <Field name="website" label="Website" state={state}>
              <Input id="website" name="website" placeholder="https://…" />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="email" label="E-mail" state={state}>
              <Input id="email" name="email" type="email" />
            </Field>
            <Field name="phone" label="Telefone" state={state}>
              <Input id="phone" name="phone" />
            </Field>
          </FieldGrid>

          <Field name="address" label="Endereço" state={state}>
            <Textarea id="address" name="address" rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
