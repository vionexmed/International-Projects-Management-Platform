"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createProjectAction } from "@/server/actions/projects";

export type Option = { id: string; name: string; country?: string | null };

/**
 * Creating a project also creates its four stages server-side, so the form
 * stays short: identity, ownership and dates.
 */
export function NewProjectDialog({
  suppliers,
  owners,
  suggestedCode,
}: {
  suppliers: Option[];
  owners: Option[];
  suggestedCode: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="primary">
          <Plus />
          Novo projeto
        </Button>
      }
      title="Novo projeto"
      description="As etapas Clinical, Regulatory, Import & Logistics e Go-to-Market são criadas automaticamente."
      action={createProjectAction}
      submitLabel="Criar projeto"
      successMessage="Projeto criado com sucesso."
      redirectTo={(id) => `/projects/${id}`}
      size="lg"
    >
      {(state) => (
        <>
          <FieldGrid>
            <Field name="name" label="Nome do projeto" required state={state}>
              <Input id="name" name="name" required placeholder="Product Alpha" />
            </Field>
            <Field name="projectCode" label="Código do projeto" required state={state}>
              <Input id="projectCode" name="projectCode" required defaultValue={suggestedCode} />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="supplierId" label="Fornecedor" required state={state}>
              <Select id="supplierId" name="supplierId" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.country ? ` · ${supplier.country}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="country" label="País" required state={state}>
              <Input id="country" name="country" required placeholder="China" />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="productType" label="Tipo de produto" state={state}>
              <Input id="productType" name="productType" placeholder="Class II Device" />
            </Field>
            <Field name="category" label="Categoria" state={state}>
              <Input id="category" name="category" placeholder="Medical Device" />
            </Field>
          </FieldGrid>

          <Field name="ownerId" label="Responsável" required state={state}>
            <Select id="ownerId" name="ownerId" required defaultValue="">
              <option value="" disabled>
                Selecione…
              </option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
          </Field>

          <FieldGrid>
            <Field name="startDate" label="Data de início" state={state}>
              <Input id="startDate" name="startDate" type="date" />
            </Field>
            <Field name="targetLaunchDate" label="Lançamento previsto" state={state}>
              <Input id="targetLaunchDate" name="targetLaunchDate" type="date" />
            </Field>
          </FieldGrid>

          <Field name="description" label="Descrição" state={state}>
            <Textarea id="description" name="description" rows={3} placeholder="Objetivo e escopo do projeto." />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
