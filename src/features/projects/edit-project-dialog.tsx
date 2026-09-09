"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { updateProjectAction } from "@/server/actions/projects";
import type { Option } from "@/features/projects/new-project-dialog";

export type EditableProject = {
  id: string;
  name: string;
  ownerId: string;
  country: string;
  productType: string | null;
  category: string | null;
  description: string | null;
  blockerNote: string | null;
  status: "ON_TRACK" | "AT_RISK" | "BLOCKED" | "COMPLETED";
  startDate: string;
  targetLaunchDate: string;
};

const STATUS_OPTIONS = [
  { value: "ON_TRACK", label: "Em dia" },
  { value: "AT_RISK", label: "Em risco" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "COMPLETED", label: "Concluído" },
];

export function EditProjectDialog({
  project,
  owners,
}: {
  project: EditableProject;
  owners: Option[];
  suppliers: Option[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <Pencil />
          Editar projeto
        </Button>
      }
      title="Editar projeto"
      action={updateProjectAction}
      submitLabel="Salvar alterações"
      successMessage="Projeto atualizado."
      size="lg"
    >
      {(state) => (
        <>
          <input type="hidden" name="projectId" value={project.id} />

          <Field name="name" label="Nome do projeto" required state={state}>
            <Input id="name" name="name" required defaultValue={project.name} />
          </Field>

          <FieldGrid>
            <Field name="ownerId" label="Responsável" required state={state}>
              <Select id="ownerId" name="ownerId" required defaultValue={project.ownerId}>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="status" label="Status" required state={state}>
              <Select id="status" name="status" required defaultValue={project.status}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="country" label="País" required state={state}>
              <Input id="country" name="country" required defaultValue={project.country} />
            </Field>
            <Field name="category" label="Categoria" state={state}>
              <Input id="category" name="category" defaultValue={project.category ?? ""} />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="productType" label="Tipo de produto" state={state}>
              <Input id="productType" name="productType" defaultValue={project.productType ?? ""} />
            </Field>
            <Field name="targetLaunchDate" label="Lançamento previsto" state={state}>
              <Input
                id="targetLaunchDate"
                name="targetLaunchDate"
                type="date"
                defaultValue={project.targetLaunchDate}
              />
            </Field>
          </FieldGrid>

          <Field name="startDate" label="Data de início" state={state}>
            <Input id="startDate" name="startDate" type="date" defaultValue={project.startDate} />
          </Field>

          <Field name="description" label="Descrição" state={state}>
            <Textarea id="description" name="description" rows={3} defaultValue={project.description ?? ""} />
          </Field>

          <Field
            name="blockerNote"
            label="Bloqueio atual"
            hint="Preencher este campo marca o projeto como bloqueado automaticamente."
            state={state}
          >
            <Textarea id="blockerNote" name="blockerNote" rows={2} defaultValue={project.blockerNote ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
