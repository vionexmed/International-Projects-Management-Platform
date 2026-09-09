"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { inviteTeamMemberAction } from "@/server/actions/users";

const ROLES = [
  { value: "MANAGER", label: "Gestor" },
  { value: "REGULATORY", label: "Regulatório" },
  { value: "IMPORT", label: "Importação" },
  { value: "MARKETING", label: "Marketing" },
  { value: "VIEWER", label: "Visualizador" },
  { value: "ADMIN", label: "Administrador" },
];

export function InviteMemberDialog() {
  return (
    <FormDialog
      trigger={
        <Button variant="primary">
          <UserPlus />
          Convidar membro
        </Button>
      }
      title="Convidar membro da equipe"
      description="O acesso é criado imediatamente com a senha definida abaixo."
      action={inviteTeamMemberAction}
      submitLabel="Criar acesso"
      successMessage="Membro adicionado à equipe."
    >
      {(state) => (
        <>
          <FieldGrid>
            <Field name="name" label="Nome" required state={state}>
              <Input id="name" name="name" required />
            </Field>
            <Field name="jobTitle" label="Cargo" state={state}>
              <Input id="jobTitle" name="jobTitle" placeholder="Especialista Regulatória" />
            </Field>
          </FieldGrid>

          <Field name="email" label="E-mail" required state={state}>
            <Input id="email" name="email" type="email" required placeholder="nome@vionex.com" />
          </Field>

          <Field
            name="password"
            label="Senha inicial"
            hint="Mínimo de 8 caracteres."
            required
            state={state}
          >
            <Input id="password" name="password" type="password" required minLength={8} />
          </Field>

          <FieldGrid>
            <Field name="role" label="Papel" required state={state}>
              <Select id="role" name="role" defaultValue="REGULATORY">
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="department" label="Departamento" state={state}>
              <Input id="department" name="department" placeholder="Regulatory" />
            </Field>
          </FieldGrid>
        </>
      )}
    </FormDialog>
  );
}
