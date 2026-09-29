"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { requestDocumentAction } from "@/server/actions/documents";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "IFU", label: "IFU" },
  { value: "REGULATORY", label: "Regulatório" },
  { value: "CLINICAL", label: "Clínico" },
  { value: "CONTRACT", label: "Contrato" },
  { value: "NDA", label: "NDA" },
  { value: "IMPORT", label: "Importação" },
  { value: "COMMERCIAL", label: "Comercial" },
  { value: "PRESENTATION", label: "Apresentação" },
  { value: "OTHER", label: "Outro" },
];

/**
 * The documents Vionex asks manufacturers for again and again. Picking one
 * fills the name, the category and English instructions, so a request is a
 * review-and-send instead of a form to write — and every supplier receives
 * the same, complete wording.
 */
const TEMPLATES: { title: string; type: string; description: string }[] = [
  {
    title: "Certificate of Analysis",
    type: "CERTIFICATE",
    description:
      "Please upload the Certificate of Analysis for the current commercial batch, signed and dated by your Quality department.",
  },
  {
    title: "Instructions for Use (IFU)",
    type: "IFU",
    description:
      "Please upload the latest approved Instructions for Use, in English, as PDF. Include the revision number and date.",
  },
  {
    title: "ISO 13485 Certificate",
    type: "CERTIFICATE",
    description:
      "Please upload your valid ISO 13485 certificate, including the scope and the expiry date.",
  },
  {
    title: "CE Certificate",
    type: "CERTIFICATE",
    description:
      "Please upload the valid CE certificate (MDR/IVDR) issued by your Notified Body for this product.",
  },
  {
    title: "Free Sale Certificate",
    type: "REGULATORY",
    description:
      "Please upload a Free Sale Certificate (Certificate to Foreign Government) for this product, issued within the last 12 months.",
  },
  {
    title: "Technical File",
    type: "REGULATORY",
    description:
      "Please upload the technical documentation for this product (device description, design, risk management and verification summaries).",
  },
  {
    title: "Clinical Evaluation Report",
    type: "CLINICAL",
    description: "Please upload the current Clinical Evaluation Report, with its revision date.",
  },
  {
    title: "Commercial Invoice",
    type: "IMPORT",
    description:
      "Please upload the commercial invoice for this shipment, with HS codes, quantities and unit values.",
  },
];

export type RequestProjectOption = {
  id: string;
  name: string;
  projectCode: string;
  supplierName: string;
};

/**
 * Asks a supplier for a document. The request lands in their portal under
 * Action Required and notifies every user of that company; all the supplier
 * does is attach the file.
 *
 * Inside a project, pass `projectId` + `supplierName`. Anywhere else
 * (Documentos, Regulatório, a supplier's page) pass `projects` and the form
 * starts by asking which project it is for.
 */
export function RequestDocumentDialog({
  projectId,
  supplierName,
  projects,
  variant = "primary",
}: {
  projectId?: string;
  supplierName?: string;
  projects?: RequestProjectOption[];
  variant?: "primary" | "secondary";
}) {
  const [selectedProject, setSelectedProject] = React.useState(projectId ?? "");
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState("CERTIFICATE");
  const [description, setDescription] = React.useState("");

  const chosen = projects?.find((project) => project.id === selectedProject);
  const recipient = supplierName ?? chosen?.supplierName;

  const applyTemplate = (template: (typeof TEMPLATES)[number]) => {
    setTitle(template.title);
    setType(template.type);
    setDescription(template.description);
  };

  return (
    <FormDialog
      trigger={
        <Button variant={variant} size="sm">
          <Send />
          Solicitar documento
        </Button>
      }
      title="Solicitar documento"
      description={
        recipient
          ? `A solicitação será enviada para ${recipient} no Supplier Portal. O fornecedor só precisa anexar o arquivo.`
          : "Escolha o projeto; a solicitação vai para o fornecedor dele no Supplier Portal."
      }
      action={requestDocumentAction}
      submitLabel="Enviar solicitação"
      successMessage="Solicitação enviada ao fornecedor."
    >
      {(state) => (
        <>
          {projects ? (
            <Field name="projectId" label="Projeto" required state={state}>
              <Select
                id="projectId"
                name="projectId"
                required
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
              >
                <option value="" disabled>
                  Selecione o projeto…
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} · {project.projectCode} — {project.supplierName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="projectId" value={projectId} />
          )}

          <div>
            <p className="mb-2 text-label font-medium text-ink-soft">Modelos prontos</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  aria-pressed={title === template.title}
                  className={cn(
                    "h-8 rounded-sm border px-2.5 text-label transition-colors",
                    title === template.title
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
                  )}
                >
                  {template.title}
                </button>
              ))}
            </div>
          </div>

          <Field name="title" label="Documento solicitado" required state={state}>
            <Input
              id="title"
              name="title"
              required
              placeholder="Certificate of Analysis"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <FieldGrid>
            <Field name="type" label="Categoria" required state={state}>
              <Select id="type" name="type" value={type} onChange={(event) => setType(event.target.value)}>
                {TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="dueDate" label="Prazo" state={state}>
              <Input id="dueDate" name="dueDate" type="date" />
            </Field>
          </FieldGrid>

          <Field
            name="description"
            label="Instruções para o fornecedor"
            hint="Em inglês — o fornecedor lê esta mensagem no portal. Os modelos já vêm preenchidos."
            state={state}
          >
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Please provide the latest Certificate of Analysis for the product."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <div className="flex items-center gap-2.5 rounded-sm border border-line bg-subtle px-3 py-2.5">
            <Checkbox id="createTask" name="createTask" defaultChecked />
            <Label htmlFor="createTask" className="cursor-pointer font-normal">
              Criar tarefa interna de acompanhamento
            </Label>
          </div>
        </>
      )}
    </FormDialog>
  );
}
