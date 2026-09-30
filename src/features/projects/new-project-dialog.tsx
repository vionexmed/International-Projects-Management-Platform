"use client";

import * as React from "react";
import { ChevronRight, FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog, FormSection } from "@/components/app/form-dialog";
import { createProjectAction } from "@/server/actions/projects";

export type Option = { id: string; name: string; country?: string | null };

const STAGES = ["Clínico", "Regulatório", "Importação e Logística", "Go-to-Market"];

/**
 * Creating a project also creates its four stages server-side, so the form
 * stays short: identity, the supplier, ownership and dates. Picking the
 * supplier fills the country from its record, until the country is typed by
 * hand.
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
  const countryRef = React.useRef<HTMLInputElement>(null);
  // Whether the country on screen came from the supplier (and may follow it) or from the keyboard.
  const countryFromSupplier = React.useRef(true);

  const onSupplier = (supplierId: string) => {
    const input = countryRef.current;
    const country = suppliers.find((supplier) => supplier.id === supplierId)?.country;
    if (!input || !country || (input.value && !countryFromSupplier.current)) return;
    input.value = country;
    countryFromSupplier.current = true;
    // Let the form's progress bar see the new value.
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <FormDialog
      trigger={
        <Button variant="primary">
          <Plus />
          Novo projeto
        </Button>
      }
      guided
      icon={<FolderPlus />}
      title="Novo projeto"
      description="Um produto de um fornecedor, do estudo clínico ao lançamento no Brasil."
      action={createProjectAction}
      submitLabel="Criar projeto"
      successMessage="Projeto criado."
      redirectTo={(id) => `/projects/${id}`}
      size="lg"
    >
      {(state) => (
        <>
          {/* What gets created along with it: the four stages, in order. */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-subtle px-3.5 py-2.5 text-meta text-muted">
            <span className="mr-1 font-medium text-ink-soft">Etapas criadas automaticamente</span>
            {STAGES.map((stage, index) => (
              <React.Fragment key={stage}>
                {index > 0 ? <ChevronRight className="size-3 text-faint" aria-hidden /> : null}
                <span className="rounded-full bg-surface px-2 py-0.5 text-ink-soft ring-1 ring-line-soft">{stage}</span>
              </React.Fragment>
            ))}
          </div>

          <FormSection title="Produto">
            <FieldGrid>
              <Field name="name" label="Nome do projeto" required state={state}>
                <Input id="name" name="name" required placeholder="Product Alpha" autoComplete="off" />
              </Field>
              <Field name="projectCode" label="Código do projeto" required hint="Sugerido; pode alterar." state={state}>
                <Input id="projectCode" name="projectCode" required defaultValue={suggestedCode} autoComplete="off" />
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
          </FormSection>

          <FormSection title="Fornecedor">
            <FieldGrid>
              <Field name="supplierId" label="Fornecedor" required state={state}>
                <Select
                  id="supplierId"
                  name="supplierId"
                  required
                  defaultValue=""
                  onChange={(event) => onSupplier(event.target.value)}
                >
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
              <Field name="country" label="País de origem" required hint="Preenchido pelo fornecedor escolhido." state={state}>
                <Input
                  ref={countryRef}
                  id="country"
                  name="country"
                  required
                  placeholder="China"
                  autoComplete="off"
                  onInput={(event) => {
                    // Only real typing takes the country over; the autofill dispatches its own event.
                    if (event.nativeEvent.isTrusted) countryFromSupplier.current = false;
                  }}
                />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormSection title="Responsável e prazos">
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
          </FormSection>

          <FormSection title="Descrição">
            <Field name="description" label="Descrição" state={state}>
              <Textarea id="description" name="description" rows={3} placeholder="Objetivo e escopo do projeto." />
            </Field>
          </FormSection>
        </>
      )}
    </FormDialog>
  );
}
