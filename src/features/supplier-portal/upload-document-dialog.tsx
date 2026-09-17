"use client";

import * as React from "react";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { FileDropzone } from "@/components/app/file-dropzone";
import { useDirectUpload } from "@/components/app/use-direct-upload";
import { uploadDocumentAction } from "@/server/actions/documents";
import { interpolate, type Dictionary } from "@/lib/i18n/dictionary";
import { OPTIONS, label } from "@/lib/labels";

/**
 * Lets a supplier send a document without waiting for a request — the case the
 * request-only flow could not cover (a new certificate, an updated IFU).
 * Anything uploaded here is shared with Vionex by definition; the service
 * pins the visibility, so the form has no choice to get wrong.
 */
export function SupplierUploadDialog({
  projects,
  projectId,
  dict,
  accept,
  maxSizeMb,
}: {
  projects?: { id: string; name: string }[];
  projectId?: string;
  dict: Dictionary;
  accept: string;
  maxSizeMb: number;
}) {
  const { prepare } = useDirectUpload();

  /**
   * Large files go straight to storage before the form is sent.
   *
   * The request carrying a 5 MB document is rejected by the platform at the
   * edge, before the application runs — so there is no error message to show,
   * only a blank failure. This moves the bytes off that path entirely.
   */
  const beforeSubmit = React.useCallback(
    async (form: HTMLFormElement) => {
      const input = form.elements.namedItem("file") as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) return null;

      const target =
        projectId ??
        (form.elements.namedItem("projectId") as HTMLSelectElement | null)?.value;
      if (!target) return "Selecione um projeto.";

      const prepared = await prepare(file, target);
      if (!prepared.ok) return prepared.error;

      if (prepared.token) {
        const token = form.elements.namedItem("uploadToken") as HTMLInputElement;
        token.value = prepared.token;
        input!.value = "";
      }
      return null;
    },
    [prepare, projectId],
  );

  return (
    <FormDialog
      trigger={
        <Button variant="primary" size="sm">
          <Upload />
          {dict.portal.documents.uploadButton}
        </Button>
      }
      title={dict.portal.documents.uploadButton}
      description={dict.portal.documents.subtitle}
      action={uploadDocumentAction}
      beforeSubmit={beforeSubmit}
      submitLabel={dict.common.submit}
      successMessage={dict.portal.requests.submitSuccess}
    >
      {(state) => (
        <>
          <input type="hidden" name="uploadToken" defaultValue="" />
          {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
          {/* Supplier uploads are always visible to the supplier that sent them. */}
          <input type="hidden" name="shareWithSupplier" value="on" />

          {!projectId && projects ? (
            <Field name="projectId" label={dict.common.project} required state={state}>
              <Select id="projectId" name="projectId" required defaultValue="">
                <option value="" disabled>
                  {dict.common.search}…
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
            <Field name="name" label={dict.portal.documents.title} state={state}>
              <Input id="name" name="name" placeholder="Certificate of Analysis" />
            </Field>
            <Field name="type" label={dict.common.type} required state={state}>
              <Select id="type" name="type" defaultValue="CERTIFICATE">
                {OPTIONS.documentType.map((type) => (
                  <option key={type} value={type}>
                    {label.documentType(type, dict)}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>

          <Field name="file" label={dict.portal.requests.uploadTitle} required state={state}>
            <FileDropzone
              accept={accept}
              maxSizeMb={maxSizeMb}
              required
              hint={interpolate(dict.portal.requests.allowedTypes, { size: maxSizeMb })}
              labels={{
                title: dict.portal.requests.uploadTitle,
                dropHint: dict.portal.requests.uploadHint,
                choose: dict.portal.requests.chooseFile,
              }}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
