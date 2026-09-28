"use client";

import * as React from "react";
import type { ActionState } from "@/server/actions/utils";

/**
 * Runs a server action from a form **without letting React clear the fields**.
 *
 * `<form action={fn}>` looks like the obvious way to do this and has a sharp
 * edge. React wraps the action like so (react-dom, `startHostTransition`):
 *
 *     function () {
 *       requestFormReset(formFiber);
 *       return action(formData);
 *     }
 *
 * The reset is requested *before* the action runs and commits when the
 * transition finishes — whatever the action returned. Actions in this codebase
 * report failure by returning `{ error }` rather than throwing, so the
 * transition always finishes successfully and the form is always wiped. The
 * user reads "check the highlighted fields" next to fields that no longer
 * contain anything.
 *
 * That is merely annoying on a two-field dialog. On the supplier's submission
 * form, over a slow link, it means the note they typed and the file they
 * attached both vanish at the exact moment the upload failed — which is the
 * moment they are least willing to start over.
 *
 * Driving the transition from `onSubmit` skips that wrapper entirely, so the
 * fields survive a failure and are cleared explicitly on success instead.
 *
 * The cost is that `useFormStatus` no longer sees a form action; `pending` is
 * returned here and passed down as a prop.
 */
export function useFormAction(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess?: (result: ActionState, form: HTMLFormElement) => void,
  /**
   * Shown when the action could not be reached at all — a dropped connection
   * rejects the call instead of returning `{ error }`, and an uncaught
   * rejection in a transition replaces the whole page with the error screen,
   * taking the typed note and the chosen file with it.
   */
  options: { unreachableError?: string } = {},
) {
  const { unreachableError } = options;
  const [state, setState] = React.useState<ActionState>({});
  const [pending, startTransition] = React.useTransition();

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);

      startTransition(async () => {
        let result: ActionState;
        try {
          result = await action(state, formData);
        } catch (error) {
          // Framework control flow (redirect, notFound) is not a failure.
          const digest = (error as { digest?: unknown } | null)?.digest;
          if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
          result = {
            error:
              unreachableError ??
              "Não foi possível concluir. Verifique sua conexão e tente novamente.",
          };
        }
        setState(result);
        if (result.ok) onSuccess?.(result, form);
      });
    },
    [action, onSuccess, state, unreachableError],
  );

  const reset = React.useCallback(() => setState({}), []);

  return { state, pending, onSubmit, reset };
}
