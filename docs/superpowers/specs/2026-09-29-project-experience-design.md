# Project Experience Design

## Goal

Make each project feel like a focused workspace: an editable plan with persistent columns, an overview that leads with delivery progress, and a calm document-submission flow for suppliers.

## Scope

The change covers project pages for internal users and suppliers. It does not change document review, task status derivation, existing permissions, or historical task data.

## 1. Persistent project plan

Each project owns a configurable plan schema.

- Built-in task fields remain: title, status, assignee, due date, priority and supplier context.
- Internal users with existing task-update permission can add, rename, hide and reorder custom columns.
- Initial custom field types are text, select, date, number and person. Select options belong to their column.
- Each custom value is stored against a task and a project column, so it survives refreshes and is available in list and board views.
- Adding a task opens a compact inline row or the existing task sheet; no new modal-only workflow is required.
- The supplier portal presents a simplified, read-only plan context; suppliers keep their current task/document actions and cannot alter a project's schema or internal fields.

Data model:

- `ProjectPlanColumn`: project, stable key, name, type, position, visibility and select options.
- `TaskPlanValue`: task, column and typed JSON value.
- A migration creates no custom columns for existing projects, so current plans retain their exact appearance until a user adds one.

## 2. Shared project frame and overview

Every project tab uses the same content gutter below the project header. The header and tabs remain full-width; page content no longer starts against the viewport edge.

The overview removes the KPI-card strip. Its first element is a concise project progress header: overall percentage, current stage and delivery condition. The primary section is a richer stage-progress view with progress, task completion, state, next deadline and a clear route into each stage. Supporting content appears only when actionable: next milestone, a blocker/risk callout and recent activity. Properties move into quiet context rather than competing with delivery information.

The supplier overview follows the same hierarchy, but says what Vionex needs next rather than exposing internal health or operational metadata.

## 3. Supplier document submission

The submission page becomes a centered, single-purpose flow.

- A compact request summary stays above the fold: document, project, deadline and what Vionex needs.
- The upload surface is the focal element with visible drag, selected-file, validation, upload-progress and retry/error states.
- A response note is clearly optional and the final action explains what happens after submission.
- The existing direct-upload ticket, server-side validation, request status transitions and review flow remain unchanged.

The interaction follows established upload guidance: keyboard-accessible file selection alongside drag-and-drop; each file has an explicit state; errors explain recovery rather than relying on color alone. See [UX Patterns](https://uxpatterns.dev/patterns/forms/file-input) and [Visa Design System](https://design.visa.com/patterns/file-upload/usage/).

## Permissions and safety

- Every column and value read/write is scoped through the existing project/task authorization checks.
- A value may only be written to a column owned by the task's project.
- Deleting a column removes its values through database referential integrity; this requires an explicit confirmation in the internal UI.
- Supplier sessions never receive internal-only custom values.

## Verification

- Unit tests for column/type validation and project-scoped values.
- Integration tests for authorization, creating/editing/reordering columns, and no cross-project access.
- Existing document-request submission/review tests remain green.
- UI tests cover the primary plan/overview/upload states; typecheck, lint and full test suite run before merge.
