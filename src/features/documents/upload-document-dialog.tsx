"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { FileDropzone } from "@/components/app/file-dropzone";
import { uploadDocumentAction } from "@/server/actions/documents";

const TYPES = [
  { value: "CONTRACT", label: "Contrato" },
  { value: "NDA", label: "NDA" },
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "IFU", label: "IFU" },
  { value: "CLINICAL", label: "Clínico" },
  { value: "REGULATORY", label: "Regulatório" },
  { value: "PRESENTATION", label: "Apresentação" },
  { value: "IMPORT", label: "Importação" },
  { value: "COMMERCIAL", label: "Comercial" },
  { value: "OTHER", label: "Outro" },
];

export type ProjectOption = { id: string; name: string };

export function UploadDocumentDialog({
  projects,
  projectId,
  accept,
  maxSizeMb,
  variant = "primary",
}: {
  projects?: ProjectOption[];
  projectId?: string;
  accept: string;
  maxSizeMb: number;
  variant?: "primary" | "secondary";
}) {
  return (
    <FormDialog
      trigger={
        <Button variant={variant} size="sm">
          <Upload />
          Enviar documento
        </Button>
      }
      title="Enviar documento"
      description="Documentos internos não são visíveis para o fornecedor até serem compartilhados."
      action={uploadDocumentAction}
      submitLabel="Enviar"
      successMessage="Documento enviado."
    >
      {(state) => (
        <>
          {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}

          {!projectId && projects ? (
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

          <FieldGrid>
            <Field name="name" label="Nome do documento" hint="Se vazio, usa o nome do arquivo." state={state}>
              <Input id="name" name="name" placeholder="Certificate of Analysis" />
            </Field>
            <Field name="type" label="Tipo" required state={state}>
              <Select id="type" name="type" defaultValue="OTHER">
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <Field name="file" label="Arquivo" required state={state}>
            <FileDropzone
              accept={accept}
              maxSizeMb={maxSizeMb}
              required
              hint={`PDF, DOCX, XLSX, PPTX, PNG ou JPG · até ${maxSizeMb} MB`}
              labels={{
                title: "Enviar documento",
                dropHint: "Arraste e solte o arquivo aqui",
                choose: "Escolher arquivo",
              }}
            />
          </Field>

          <div className="flex items-center gap-2.5 rounded-sm border border-line bg-subtle px-3 py-2.5">
            <Checkbox id="shareWithSupplier" name="shareWithSupplier" />
            <Label htmlFor="shareWithSupplier" className="cursor-pointer font-normal">
              Compartilhar com o fornecedor
            </Label>
          </div>
        </>
      )}
    </FormDialog>
  );
}
