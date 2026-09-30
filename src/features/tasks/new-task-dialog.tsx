"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { createTaskAction } from "@/server/actions/tasks";

export const TASK_CATEGORIES = [
  { value: "REGULATORY", label: "Regulatório" },
  { value: "CLINICAL", label: "Clínico" },
  { value: "IMPORT", label: "Importação" },
  { value: "GO_TO_MARKET", label: "Go-to-Market" },
  { value: "GENERAL", label: "Geral" },
];

export const TASK_PRIORITIES = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export const SUPPLIER_TASK_HINT =
  "O envio acontece na aba Documentos e não conclui a tarefa. Para coletar um arquivo com revisão, use uma solicitação de documento formal.";

export type TaskProjectOption = {
  id: string;
  name: string;
  projectCode?: string;
  supplier?: { id: string; name: string };
};

/**
 * Company first, then one of its projects: picking the company narrows the
 * projects to the right ones, so a task cannot land on a namesake project of
 * another supplier. A company with a single project has it chosen for you.
 */
function CompanyProjectPicker({
  projects,
  state,
  onSupplier,
}: {
  projects: TaskProjectOption[];
  state: Parameters<typeof Field>[0]["state"];
  onSupplier: (name: string | undefined) => void;
}) {
  const companies = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const project of projects) if (project.supplier) seen.set(project.supplier.id, project.supplier.name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [projects]);
  const [companyId, setCompanyId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const options = projects.filter((project) => project.supplier?.id === companyId);

  return (
    <FieldGrid>
      <Field name="companyId" label="Empresa" required state={state}>
        <Select
          id="companyId"
          required
          value={companyId}
          onChange={(event) => {
            const next = event.target.value;
            setCompanyId(next);
            const own = projects.filter((project) => project.supplier?.id === next);
            setProjectId(own.length === 1 ? own[0].id : "");
            onSupplier(companies.find((company) => company.id === next)?.name);
          }}
        >
          <option value="" disabled>
            Selecione a empresa…
          </option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field name="projectId" label="Projeto" required state={state}>
        <Select
          id="projectId"
          name="projectId"
          required
          disabled={!companyId}
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="" disabled>
            {companyId ? "Selecione o projeto…" : "Escolha a empresa primeiro"}
          </option>
          {options.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectCode ? `${project.projectCode} · ${project.name}` : project.name}
            </option>
          ))}
        </Select>
      </Field>
    </FieldGrid>
  );
}

export function NewTaskDialog({
  projects,
  projectId,
  owners,
  supplierName,
  defaultCategory = "GENERAL",
  variant = "primary",
  size,
}: {
  projects?: TaskProjectOption[];
  projectId?: string;
  owners: { id: string; name: string }[];
  /** Shown next to the "waiting on supplier" toggle when the project is fixed. */
  supplierName?: string;
  defaultCategory?: string;
  variant?: "primary" | "secondary";
  /** Defaults to 36 px for a primary and 32 px for a secondary; toolbars pass "sm". */
  size?: "sm" | "md";
}) {
  // The supplier the "waiting" toggle names: fixed with the project, or the company picked.
  const [pickedSupplier, setPickedSupplier] = React.useState<string | undefined>();
  const waitingOn = supplierName ?? pickedSupplier;
  const byCompany = Boolean(projects?.length && projects.every((project) => project.supplier));
  return (
    <FormDialog
      trigger={
        <Button variant={variant} size={size ?? (variant === "primary" ? "md" : "sm")}>
          <Plus />
          Nova tarefa
        </Button>
      }
      title="Nova tarefa"
      action={createTaskAction}
      submitLabel="Criar tarefa"
      successMessage="Tarefa criada."
      size="lg"
    >
      {(state) => (
        <>
          {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}

          {!projectId && projects && byCompany ? (
            <CompanyProjectPicker projects={projects} state={state} onSupplier={setPickedSupplier} />
          ) : null}

          {!projectId && projects && !byCompany ? (
            <Field name="projectId" label="Projeto" required state={state}>
              <Select id="projectId" name="projectId" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field name="title" label="Título" required state={state}>
            <Input id="title" name="title" required placeholder="Certificate of Analysis" />
          </Field>

          <FieldGrid>
            <Field name="category" label="Categoria" required state={state}>
              <Select id="category" name="category" defaultValue={defaultCategory}>
                {TASK_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="priority" label="Prioridade" required state={state}>
              <Select id="priority" name="priority" defaultValue="MEDIUM">
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field name="assignedToId" label="Responsável" state={state}>
              <Select id="assignedToId" name="assignedToId" defaultValue="">
                <option value="">Sem responsável</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </FieldGrid>

          <Field name="description" label="Descrição" state={state}>
            <Textarea id="description" name="description" rows={3} />
          </Field>

          <div className="flex items-start gap-2.5 rounded-sm border border-line bg-subtle px-3 py-2.5">
            <Checkbox id="waitingOnSupplier" name="waitingOnSupplier" className="mt-0.5" />
            <div>
              <Label htmlFor="waitingOnSupplier" className="cursor-pointer font-normal">
                Aguardando o fornecedor{waitingOn ? ` (${waitingOn})` : ""}
              </Label>
              <p className="mt-0.5 text-[12px] text-muted">
                A tarefa ficará visível para o fornecedor no Supplier Portal.
              </p>
              <p className="mt-1 text-[12px] text-muted">{SUPPLIER_TASK_HINT}</p>
            </div>
          </div>
        </>
      )}
    </FormDialog>
  );
}
