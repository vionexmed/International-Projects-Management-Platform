import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The forms must not be cleared when an action fails.
 *
 * React wraps a form action like this (react-dom, `startHostTransition`):
 *
 *     function () {
 *       requestFormReset(formFiber);
 *       return action(formData);
 *     }
 *
 * The reset is requested *before* the action runs and commits when the
 * transition finishes — regardless of what came back. Actions in this codebase
 * report failure by returning `{ error }` rather than throwing, so the
 * transition always finishes successfully and the fields were always wiped:
 * the user read "check the highlighted fields" beside fields that no longer
 * held anything.
 *
 * On the supplier's submission form, over a bad link, that meant losing the
 * note and the attachment at the moment the upload failed.
 *
 * The fix is to drive the transition from `onSubmit`, which skips that wrapper.
 * It is a structural property, so this is a structural test: a future edit that
 * goes back to `<form action={…}>` reintroduces the bug silently, and this is
 * what fails and explains why.
 */
const root = path.resolve(import.meta.dirname, "..", "..");

const FORMS_THAT_MUST_SURVIVE_FAILURE = [
  "src/components/app/form-dialog.tsx",
  "src/features/supplier-portal/submit-request-form.tsx",
];

function source(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("forms keep what the user typed when an action fails", () => {
  it.each(FORMS_THAT_MUST_SURVIVE_FAILURE)("%s drives the action from onSubmit", (relative) => {
    const code = source(relative);

    expect(code).toContain("useFormAction");
    expect(code).toContain("onSubmit={onSubmit}");
  });

  it.each(FORMS_THAT_MUST_SURVIVE_FAILURE)("%s never passes a form action", (relative) => {
    const code = source(relative);

    // `<form action={…}>` is the construct that triggers requestFormReset.
    expect(code).not.toMatch(/<form[^>]*\saction=\{/);
  });

  it("clears the field only on success, and explicitly", () => {
    const hook = source("src/components/app/use-form-action.ts");

    // The success callback is the only path that touches the form, and the
    // submit is intercepted so React never gets to schedule a reset of its own.
    expect(hook).toContain("if (result.ok) onSuccess?.(result, form)");
    expect(hook).toContain("event.preventDefault()");
    expect(hook).toContain("startTransition");
  });

  it("remounts the file field instead of trusting form.reset()", () => {
    // The dropzone holds the chosen file in React state *and* in the native
    // input. `form.reset()` clears only the second, which is how the zone kept
    // displaying a file that was no longer attached.
    const form = source("src/features/supplier-portal/submit-request-form.tsx");
    expect(form).toContain("key={clearedAt}");
  });
});
