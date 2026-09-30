import * as React from "react";

export type InlineSaveResult = { draft: string; saved: string; error: string | null };

const CONNECTION_ERROR = "Não foi possível salvar. Verifique sua conexão e tente novamente.";

/**
 * One save of an in-place cell. Unchanged text is never sent; a rejected or
 * failed save keeps the user's draft next to the last saved value, so the
 * cell can show the error and the text is still there to retry.
 */
export async function saveInlineDraft(
  draft: string,
  saved: string,
  submit: (value: string) => Promise<{ error?: string }>,
): Promise<InlineSaveResult> {
  if (draft === saved) return { draft, saved, error: null };
  try {
    const result = await submit(draft);
    if (result.error) return { draft, saved, error: result.error };
    return { draft, saved: draft, error: null };
  } catch {
    return { draft, saved, error: CONNECTION_ERROR };
  }
}

/**
 * Grows a textarea to its content. `field-sizing: content` does this natively
 * where supported; this keeps other browsers in step, including when a
 * column is resized and the text rewraps.
 */
export function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, value]);
}
