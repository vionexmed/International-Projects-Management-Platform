import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InlineTaskTitleCell } from "@/features/tasks/inline-task-title-cell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("inline task title", () => {
  it("wraps read-only titles and provides a named multiline editor", () => {
    const title = "A long title that spans more than one line";
    const readOnly = renderToStaticMarkup(<InlineTaskTitleCell taskId="task-1" title={title} editable={false} />);
    const editable = renderToStaticMarkup(<InlineTaskTitleCell taskId="task-1" title={title} editable />);

    expect(readOnly).toContain("break-words");
    expect(readOnly).not.toContain("truncate");
    expect(readOnly).toContain(title);
    expect(editable).toContain("<textarea");
    expect(editable).toContain('aria-label="Nome da tarefa: A long title that spans more than one line"');
  });
});
