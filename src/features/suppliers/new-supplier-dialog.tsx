"use client";

import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog, FormSection } from "@/components/app/form-dialog";
import { createSupplierAction } from "@/server/actions/suppliers";
import { COUNTRY_NAMES } from "@/lib/geo/countries";

export function NewSupplierDialog() {
  return (
    <FormDialog
      trigger={
        <Button variant="primary">
          <Plus />
          Novo fornecedor
        </Button>
      }
      guided
      icon={<Building2 />}
      title="Novo fornecedor"
      description="Cadastre o fabricante para vincular projetos, documentos e usuários do portal."
      action={createSupplierAction}
      submitLabel="Cadastrar fornecedor"
      successMessage="Fornecedor cadastrado."
      redirectTo={(id) => `/suppliers/${id}`}
      size="lg"
    >
      {(state) => (
        <>
          <FormSection title="Empresa">
            <FieldGrid>
              <Field name="name" label="Empresa" required state={state}>
                <Input id="name" name="name" required placeholder="Manufacturer A" autoComplete="organization" />
              </Field>
              <Field name="country" label="País" required hint="É daqui que sai a rota no mapa do dashboard." state={state}>
                <Input id="country" name="country" required placeholder="China" list="supplier-countries" autoComplete="off" />
                <datalist id="supplier-countries">
                  {COUNTRY_NAMES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Field>
            </FieldGrid>
          </FormSection>

          <FormSection title="Contato">
            <FieldGrid>
              <Field name="primaryContact" label="Contato principal" state={state}>
                <Input id="primaryContact" name="primaryContact" placeholder="John Smith" autoComplete="name" />
              </Field>
              <Field name="email" label="E-mail" state={state}>
                <Input id="email" name="email" type="email" placeholder="contato@empresa.com" autoComplete="email" />
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Field name="phone" label="Telefone" state={state}>
                <Input id="phone" name="phone" type="tel" placeholder="+86 21 5555 0000" autoComplete="tel" />
              </Field>
              <Field name="website" label="Website" state={state}>
                <Input id="website" name="website" placeholder="https://…" autoComplete="url" />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormSection title="Endereço">
            <Field name="address" label="Endereço" state={state}>
              <Textarea id="address" name="address" rows={2} placeholder="Rua, número, cidade, província/estado, CEP" />
            </Field>
          </FormSection>
        </>
      )}
    </FormDialog>
  );
}
