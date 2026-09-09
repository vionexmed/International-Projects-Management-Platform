"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { addSupplierUserAction } from "@/server/actions/users";

/**
 * Creates a Supplier Portal login. The role list is restricted to supplier
 * roles; the server refuses anything else and pins the supplier.
 */
export function AddSupplierUserDialog({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary" size="sm">
          <UserPlus />
          Adicionar usuário
        </Button>
      }
      title="Novo usuário do fornecedor"
      description={`Este usuário terá acesso ao Supplier Portal de ${supplierName}.`}
      action={addSupplierUserAction}
      submitLabel="Criar acesso"
      successMessage="Usuário criado."
    >
      {(state) => (
        <>
          <input type="hidden" name="supplierId" value={supplierId} />

          <FieldGrid>
            <Field name="name" label="Nome" required state={state}>
              <Input id="name" name="name" required placeholder="John Smith" />
            </Field>
            <Field name="jobTitle" label="Cargo" state={state}>
              <Input id="jobTitle" name="jobTitle" placeholder="Regulatory Contact" />
            </Field>
          </FieldGrid>

          <Field name="email" label="E-mail" required state={state}>
            <Input id="email" name="email" type="email" required />
          </Field>

          <Field
            name="password"
            label="Senha inicial"
            hint="Mínimo de 8 caracteres. Compartilhe com o fornecedor por um canal seguro."
            required
            state={state}
          >
            <Input id="password" name="password" type="password" required minLength={8} />
          </Field>

          <FieldGrid>
            <Field name="role" label="Papel" required state={state}>
              <Select id="role" name="role" defaultValue="SUPPLIER_USER">
                <option value="SUPPLIER_USER">Usuário do fornecedor</option>
                <option value="SUPPLIER_ADMIN">Admin do fornecedor</option>
              </Select>
            </Field>
            <Field name="language" label="Idioma" required state={state}>
              <Select id="language" name="language" defaultValue="EN">
                <option value="EN">English</option>
                <option value="ZH">中文</option>
                <option value="PT_BR">Português</option>
              </Select>
            </Field>
          </FieldGrid>
        </>
      )}
    </FormDialog>
  );
}
