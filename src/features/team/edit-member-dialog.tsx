"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { updateUserAction } from "@/server/actions/users";

export type EditableMember = {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
};

/**
 * Editing a team member.
 *
 * `updateUserAction` has existed, with its permission check, its audit entry
 * and its guard against turning an internal account into a supplier one, since
 * the schema was written — it simply had no way in. Until now the only thing
 * anyone could do to a colleague was invite them.
 *
 * Suspending is the closest thing to removal the model offers, and that is on
 * purpose: six foreign keys deliberately refuse to let a person who has created
 * a task or uploaded a document be deleted, so their history stays attributable.
 */
const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrador" },
  { value: "MANAGER", label: "Gestor" },
  { value: "REGULATORY", label: "Regulatório" },
  { value: "IMPORT", label: "Importação" },
  { value: "MARKETING", label: "Marketing" },
  { value: "VIEWER", label: "Visualizador" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "INVITED", label: "Convidado" },
  { value: "SUSPENDED", label: "Suspenso" },
];

export function EditMemberDialog({ member }: { member: EditableMember }) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="iconSm" aria-label={`Editar ${member.name}`}>
          <Pencil />
        </Button>
      }
      title="Editar membro"
      description={member.name}
      action={updateUserAction}
      submitLabel="Salvar alterações"
      successMessage="Membro atualizado."
    >
      {(state) => (
        <>
          <input type="hidden" name="userId" value={member.id} />

          <Field name="name" label="Nome" required state={state}>
            <Input id="name" name="name" required defaultValue={member.name} />
          </Field>

          <FieldGrid>
            <Field name="role" label="Papel" state={state}>
              <Select id="role" name="role" defaultValue={member.role}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              name="status"
              label="Status"
              hint="Suspender retira o acesso sem apagar o histórico."
              state={state}
            >
              <Select id="status" name="status" defaultValue={member.status}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="jobTitle" label="Cargo" state={state}>
              <Input id="jobTitle" name="jobTitle" defaultValue={member.jobTitle ?? ""} />
            </Field>
            <Field name="department" label="Departamento" state={state}>
              <Input id="department" name="department" defaultValue={member.department ?? ""} />
            </Field>
          </FieldGrid>
        </>
      )}
    </FormDialog>
  );
}
