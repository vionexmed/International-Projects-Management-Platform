# Project Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project planning genuinely editable, make progress the overview's focal point, and make supplier document submission clear and centered.

**Architecture:** Persist project-scoped custom column definitions and task values in Prisma, expose them only to authorized internal project users, and compose them into the existing plan grid. Keep existing task fields and document workflow intact; presentation changes live in focused feature components and retain server-side access checks.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Zod, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-project-experience-design.md`

## Global Constraints

- Do not change document review, task-status derivation, existing permissions, or task history.
- Custom columns are persistent and project-scoped; supported types are text, select, date, number, and person.
- Only users with the existing `task:update` capability can manage columns and values; supplier payloads must never include custom values.
- Preserve a standard content gutter in every project tab while keeping project navigation full width.
- Do not add dependencies; use the existing component and accessibility patterns.
- Run targeted tests before implementation changes, then the full suite, typecheck, and lint before completion.

## Review Focus

- A custom-column ID from a different project must be rejected when saving a task value (Task 1 integration test).
- Deleting a column must remove its values and not affect built-in task fields (Task 1 integration test).
- Invalid values for select, date, and number columns must be rejected server-side (Task 1 unit test).
- Supplier views must not receive custom-column schema or values (Task 2 payload test).
- The document form must retain native file selection, validation feedback, and a usable keyboard path (Task 4 component test).

---

### Task 1: Project-plan persistence and guarded mutations

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_project_plan_columns/migration.sql`
- Create: `src/server/services/project-plan.ts`
- Create: `src/server/actions/project-plan.ts`
- Create: `tests/unit/project-plan.test.ts`
- Create: `tests/integration/project-plan-scope.test.ts`

**Interfaces:**
- Produces `PlanColumnType`, `listProjectPlanColumns(user, projectId)`, `createProjectPlanColumn`, `updateProjectPlanColumn`, `reorderProjectPlanColumns`, `deleteProjectPlanColumn`, and `setTaskPlanValue`.
- `PlanColumnType` is `TEXT | SELECT | DATE | NUMBER | PERSON`; values are typed JSON and unique by task/column.

- [ ] **Step 1: Write failing unit and integration tests** for type validation, project ownership, cascade deletion, and cross-project value rejection.
- [ ] **Step 2: Run the focused tests** and confirm they fail because the project-plan service does not exist.
- [ ] **Step 3: Add the Prisma enum, `ProjectPlanColumn`, and `TaskPlanValue` models plus an additive migration.** Use project and task relations with cascading value cleanup and unique task/column pairs.
- [ ] **Step 4: Implement the typed service and server actions.** Re-check authorization and project/task ownership inside every action; validate select options and typed values with Zod.
- [ ] **Step 5: Run focused tests, then commit** with `feat(plan): persist project custom columns`.

### Task 2: Editable project-plan grid

**Files:**
- Modify: `src/app/(internal)/projects/[projectId]/tasks/page.tsx`
- Modify: `src/features/tasks/plan-data.ts`
- Modify: `src/features/tasks/plan-list.tsx`
- Create: `src/features/tasks/plan-custom-column-controls.tsx`
- Create: `src/features/tasks/plan-value-cell.tsx`
- Test: `tests/unit/plan-value-cell.test.tsx`
- Modify: `tests/integration/supplier-payload.test.ts`

**Interfaces:**
- Consumes the Task 1 `ProjectPlanColumn` service results and project-plan actions.
- Produces an internal-only plan grid that renders built-in fields plus visible custom columns and saves values through Task 1 actions.

- [ ] **Step 1: Write failing UI/payload tests** for rendering a typed custom value, saving it through its action, and omitting custom data from supplier responses.
- [ ] **Step 2: Run the focused tests** and confirm the custom plan controls are absent.
- [ ] **Step 3: Add custom-column controls** for add, rename, hide, delete-with-confirmation, and ordered movement, shown only for `task:update` users.
- [ ] **Step 4: Extend the list grid** with dynamic headers and accessible type-specific cells; retain the existing task sheet, status, assignee, due-date, priority, and supplier context behavior.
- [ ] **Step 5: Run focused tests, then commit** with `feat(plan): edit project columns and values`.

### Task 3: Project frame and progress-led overview

**Files:**
- Modify: `src/features/projects/project-frame.ts`
- Modify: `src/app/(internal)/projects/[projectId]/page.tsx`
- Modify: `src/app/(supplier)/supplier/projects/[projectId]/page.tsx`
- Create: `src/features/projects/project-progress-summary.tsx`
- Test: `tests/unit/project-progress-summary.test.tsx`

**Interfaces:**
- Produces `ProjectProgressSummary` used by both audiences, accepting overall percentage, current stage, next milestone, and audience-safe delivery copy.

- [ ] **Step 1: Write failing tests** for the overall progress label and stage progress presentation.
- [ ] **Step 2: Run the focused test** and confirm the shared summary is absent.
- [ ] **Step 3: Implement the shared content-gutter and progress summary.** Replace the internal KPI-card strip with a compact overall-progress lead; keep stage progress, milestones, properties, and timeline actionable.
- [ ] **Step 4: Adapt the supplier overview** to the same progress hierarchy without internal health or blocker metadata.
- [ ] **Step 5: Run focused tests, then commit** with `feat(projects): focus overview on delivery progress`.

### Task 4: Supplier document-submission experience

**Files:**
- Modify: `src/app/(supplier)/supplier/action-required/[requestId]/page.tsx`
- Modify: `src/features/supplier-portal/submit-request-form.tsx`
- Modify: `src/components/app/file-dropzone.tsx`
- Test: `tests/unit/submit-request-form.test.tsx`

**Interfaces:**
- Retains `SubmitRequestForm` direct-upload contract and existing document-request submission action.

- [ ] **Step 1: Write a failing component test** for selected-file feedback, validation error text, and the final submit action remaining reachable.
- [ ] **Step 2: Run the focused test** and confirm the new request composition is absent.
- [ ] **Step 3: Recompose the request page into a centered single-purpose flow** with a compact task summary, a responsive information block, an improved drop zone, optional note, and clear post-submit expectation.
- [ ] **Step 4: Preserve native input, drag/drop, error, progress, and retry behavior** in the existing file-drop component; do not change document state transitions.
- [ ] **Step 5: Run focused tests, then commit** with `style(supplier): streamline document submission`.

### Task 5: Whole-branch verification

**Files:**
- Modify: any files necessary for verification fixes only

**Interfaces:**
- Consumes all tasks above without changing scope.

- [ ] **Step 1: Run `npm run test`, `npm run typecheck`, and `npm run lint`.**
- [ ] **Step 2: Inspect the affected internal and supplier pages at representative desktop and mobile sizes.**
- [ ] **Step 3: Make only regression fixes discovered by verification, rerun the affected checks, then commit if needed.**
