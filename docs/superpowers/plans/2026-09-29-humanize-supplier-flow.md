# Humanize Supplier Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let suppliers upload from a supplier-assigned task while making targeted visual improvements without changing workflow semantics.

**Architecture:** The queue provides a documents-tab URL for generic tasks; the existing upload dialog reads an `open` prop supplied by that URL. Formal `DocumentRequest` routes remain unchanged. Existing shared UI tokens receive only focal-surface adjustments.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Prisma, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-humanize-supplier-flow-design.md`

## Global Constraints

- Keep all work on this local worktree branch; do not push or modify `main`.
- Do not change Prisma schema, authorization scopes, document-review status transitions, or task-completion rules.
- Preserve the dedicated `/supplier/action-required/[requestId]` route for formal document requests.
- Use test-first changes and only existing dependencies.

## Review Focus

- A formal document request still points to its request detail and not the generic upload dialog.
- A generic task still remains open after a generic document upload.
- A supplier cannot reach another supplier's project through a queue URL.
- Dialog auto-open is limited to the explicit query flag and remains user-dismissible.
- Visual token adjustments do not alter overlay elevation or focus contrast.

### Task 1: Supplier task upload entry point

**Files:**
- Modify: `src/server/services/supplier-queue.ts`, `src/app/(supplier)/supplier/projects/[projectId]/documents/page.tsx`, `src/features/supplier-portal/upload-document-dialog.tsx`
- Modify: `tests/integration/information-architecture.test.ts`

**Interfaces:**
- Produces generic task `href` as `/supplier/projects/:projectId/documents?upload=1`.
- `SupplierUploadDialog` accepts `defaultOpen?: boolean`.

- [ ] Write the failing queue assertion that a generic task opens its project document-upload destination while a document request keeps its own route.
- [ ] Run `npm run test:integration -- tests/integration/information-architecture.test.ts` and verify the assertion fails.
- [ ] Implement the minimal href and controlled initial-open wiring using the existing `FormDialog` API.
- [ ] Re-run the focused test and verify it passes.
- [ ] Commit the task.

### Task 2: Give focal work a deliberate visual hierarchy

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `vitest.config.mts`
- Create: `tests/unit/panel.test.tsx`

**Interfaces:**
- Only `Panel` focal surfaces receive the more expressive visual treatment.

- [ ] Write a failing render test proving a focal panel has an intentional radius and discreet elevation while a default panel remains flat.
- [ ] Extend Vitest's existing unit include with `*.test.tsx`, so the render test is executed; run it and verify it fails.
- [ ] Apply the minimal focal-only panel radius/elevation adjustment.
- [ ] Re-run the test, typecheck and lint; manually verify the supplier portal route in localhost.
- [ ] Commit the task.

### Task 3: Clarify supplier task semantics

**Files:**
- Modify: `src/features/tasks/new-task-dialog.tsx`
- Create: `tests/unit/task-copy.test.ts`

**Interfaces:**
- `SUPPLIER_TASK_HINT` is exported from the task dialog and rendered under the supplier-visible task toggle.

- [ ] Write a failing test that imports `SUPPLIER_TASK_HINT` and asserts it tells internal users to use a formal document request when a reviewed file is required.
- [ ] Run the focused test and verify it fails because the export does not exist.
- [ ] Add the exact concise hint to the dialog, with no behavior change.
- [ ] Re-run the focused test, unit suite, typecheck and lint.
- [ ] Commit the task.
