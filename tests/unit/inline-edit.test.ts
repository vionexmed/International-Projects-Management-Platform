import { describe, expect, it, vi } from "vitest";
import { saveInlineDraft } from "@/features/tasks/inline-edit";

describe("saveInlineDraft", () => {
  it("retains the draft and reports a rejected save", async () => {
    const result = await saveInlineDraft("new text", "old text", async () => ({ error: "Try again" }));
    expect(result).toEqual({ draft: "new text", saved: "old text", error: "Try again" });
  });

  it("updates the saved value after success", async () => {
    const result = await saveInlineDraft("new text", "old text", async () => ({}));
    expect(result).toEqual({ draft: "new text", saved: "new text", error: null });
  });

  it("does not submit unchanged text", async () => {
    const submit = vi.fn(async () => ({}));
    expect(await saveInlineDraft("same", "same", submit)).toEqual({ draft: "same", saved: "same", error: null });
    expect(submit).not.toHaveBeenCalled();
  });
});
