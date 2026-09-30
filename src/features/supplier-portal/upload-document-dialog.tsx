"use client";

import * as React from "react";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FieldGrid, FormDialog } from "@/components/app/form-dialog";
import { FileDropzone } from "@/components/app/file-dropzone";
import { flyFile } from "@/components/app/fly-to";
import { useDirectUpload } from "@/components/app/use-direct-upload";
import { uploadDocumentAction } from "@/server/actions/documents";
import { interpolate, type Dictionary } from "@/lib/i18n/dictionary";
import { OPTIONS, label } from "@/lib/labels";
import { dialogLabels } from "@/features/supplier-portal/portal-labels";

/**
 * Lets a supplier send a document without waiting for a request — the case the
 * request-only flow could not cover (a new certificate, an updated IFU).
 * Anything uploaded here is shared with Vionex by definition; the service
 * pins the visibility, so the form has no choice to get wrong.
 */
export function SupplierUploadDialog({
  projects,
  projectId,
  defaultOpen = false,
  dict,
  accept,
  maxSizeMb,
}: {
  projects?: { id: string; name: string }[];
  projectId?: string;
  defaultOpen?: boolean;
  dict: Dictionary;
  accept: string;
  maxSizeMb: number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const t = dict.portal.requests;
  // The name of the file being sent: a large one is taken out of the input once uploaded.
  const sending = React.useRef<string | null>(null);
  const { prepare, progress } = useDirectUpload({
    connectionFailed: t.connectionFailed,
    storageRefused: t.storageRefused,
  });

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
      // Checked here rather than with `required`: the real input is visually
      // hidden, so the browser's own bubble would point at nothing.
      if (!file) return dict.portal.documents.fileRequired;
      sending.current = file.name;

      const target =
        projectId ??
        (form.elements.namedItem("projectId") as HTMLSelectElement | null)?.value;
      if (!target) return dict.portal.documents.selectProject;

      const prepared = await prepare(file, target);
      if (!prepared.ok) return prepared.error;

      if (prepared.token) {
        const token = form.elements.namedItem("uploadToken") as HTMLInputElement;
        token.value = prepared.token;
        input!.value = "";
      }
      return null;
    },
    [prepare, projectId, dict],
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="primary" size="sm">
          <Upload />
          {dict.portal.documents.uploadButton}
        </Button>
      }
      title={dict.portal.documents.uploadButton}
      description={dict.portal.documents.uploadIntro}
      action={uploadDocumentAction}
      beforeSubmit={beforeSubmit}
      onSuccess={(_result, form) => {
        const zone = form.querySelector("[data-dropzone]");
        if (sending.current && zone) flyFile({ from: zone.getBoundingClientRect(), name: sending.current });
        sending.current = null;
      }}
      submitLabel={t.sendToVionex}
      successMessage={dict.portal.documents.uploaded}
      labels={dialogLabels(dict)}
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
                  {dict.portal.documents.selectProject}
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
            <Field
              name="name"
              label={dict.portal.documents.nameLabel}
              hint={dict.portal.documents.nameHint}
              state={state}
            >
              <Input id="name" name="name" placeholder={dict.portal.documents.namePlaceholder} />
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
              hint={interpolate(dict.portal.requests.allowedTypes, { size: maxSizeMb })}
              labels={{
                title: t.uploadTitle,
                dropHint: t.uploadHint,
                choose: t.chooseFile,
                remove: dict.portal.messages.removeFile,
                typeError: t.fileTypeError,
                sizeError: t.fileSizeError,
                emptyError: t.fileEmptyError,
              }}
            />
            {progress !== null ? (
              <div className="mt-3" role="status" aria-live="polite">
                <p className="mb-1.5 text-meta text-ink-soft tabular-nums">
                  {interpolate(t.uploadingPercent, { percent: progress })}
                </p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-raised"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t.uploadTitle}
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </Field>
        </>
      )}
    </FormDialog>
  );
}
