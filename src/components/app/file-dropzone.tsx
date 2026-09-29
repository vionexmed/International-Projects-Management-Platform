"use client";

import * as React from "react";
import { FileText, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";

/**
 * Drag-and-drop file field. Client-side checks are a convenience only — the
 * server re-validates type, extension and size on every upload.
 *
 * The chosen file lives in React state *and* in the native input, because the
 * form has to submit it and the zone has to draw it. `form.reset()` only
 * clears the second of those, which is how the zone used to go on showing a
 * file that was no longer attached — and a second submit sent nothing.
 *
 * To clear it from the outside, change the component's `key`. Remounting is
 * the one reset that cannot leave the two copies disagreeing.
 */
export function FileDropzone({
  name = "file",
  accept,
  maxSizeMb,
  hint,
  labels,
  required,
  className,
  disabled,
  onFileChange,
}: {
  name?: string;
  accept: string;
  maxSizeMb: number;
  hint: string;
  /**
   * The error strings are optional so existing callers keep their wording; the
   * Supplier Portal passes its own, because a manufacturer reading English
   * should not be told "Formato não permitido".
   */
  labels: {
    title: string;
    dropHint: string;
    choose: string;
    remove?: string;
    /** Shown when the extension is not accepted. */
    typeError?: string;
    /** `{size}` is replaced with the limit in MB. */
    sizeError?: string;
    emptyError?: string;
  };
  required?: boolean;
  className?: string;
  /** Blocks picking a different file while the current one is being sent. */
  disabled?: boolean;
  /** Told about every accepted change, so a form can adapt its button or checks. */
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accepted = React.useMemo(
    () => accept.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
    [accept],
  );

  const reject = (message: string) => {
    setError(message);
    setFile(null);
    onFileChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const assign = (next: File | null) => {
    if (!next) {
      setFile(null);
      setError(null);
      onFileChange?.(null);
      return;
    }

    // Checked here, before anything is uploaded, so a wrong file costs the
    // person a second rather than a long upload and a server refusal.
    const lower = next.name.toLowerCase();
    if (accepted.length > 0 && !accepted.some((extension) => lower.endsWith(extension))) {
      reject(labels.typeError ?? `Formato não permitido. Use: ${accepted.join(", ")}.`);
      return;
    }
    if (next.size === 0) {
      reject(labels.emptyError ?? "O arquivo está vazio.");
      return;
    }
    if (next.size > maxSizeMb * 1024 * 1024) {
      reject(
        (labels.sizeError ?? "O arquivo excede {size} MB.").replace("{size}", String(maxSizeMb)),
      );
      return;
    }

    setError(null);
    setFile(next);
    onFileChange?.(next);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);

    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;

    // Keep the real input in sync so the form submits the dropped file.
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    if (inputRef.current) inputRef.current.files = transfer.files;
    assign(dropped);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = "";
    assign(null);
  };

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          handleDrop(event);
        }}
        aria-busy={disabled || undefined}
        className={cn(
          "rounded-md border border-dashed px-5 py-7 text-center transition-colors",
          dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-subtle",
          error && "border-risk/40 bg-risk-soft",
          disabled && "opacity-60",
        )}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="size-5 shrink-0 text-brand-strong" aria-hidden />
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium text-ink">{file.name}</p>
              <p className="text-[12px] text-muted">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={clear}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
              aria-label={labels.remove ?? "Remover arquivo"}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-2.5 size-5 text-muted" aria-hidden />
            {/* Nothing can be dragged on a phone; there the button is the whole affordance. */}
            <p className="text-sm font-medium text-ink pointer-coarse:hidden">{labels.dropHint}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3 pointer-coarse:mt-0 pointer-coarse:h-10"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Paperclip />
              {labels.choose}
            </Button>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          required={required}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => assign(event.target.files?.[0] ?? null)}
        />
      </div>

      <p
        className={cn("mt-1.5 text-[12px]", error ? "font-medium text-risk" : "text-muted")}
        role={error ? "alert" : undefined}
      >
        {error ?? hint}
      </p>
      {error ? <p className="mt-0.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}
