# Vionex Workspace Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Vionex a consistent, polished visual language and make the project Plan a comfortable, directly editable workspace.

**Architecture:** Keep the existing Next.js server actions, permissions and database schema. Add small client-side modules for per-project view preferences, resizable columns and bounded Plan navigation; apply shared styling through existing Tailwind tokens/components rather than a new UI framework.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Tailwind 4, Radix, Vitest, Prisma.

**Spec:** `docs/superpowers/specs/2026-09-30-vionex-workspace-refresh-design.md`

## Global Constraints

- Read relevant `node_modules/next/dist/docs/` guides before changing Next.js code, per `AGENTS.md`.
- Keep the existing Vionex teal/navy brand and logo; do not install a second UI framework.
- Desktop gutters at least 24 px, mobile at least 16 px; spacing rhythm 4/8/12/16/24/32 px.
- Plan zoom 70–150% in 10% steps, default 100%; mobile uses ordinary 100% scrolling.
- Only view preferences go in browser storage; task/column data stays in the database.
- Apply title/context, grouped actions, deliberate spacing and restrained information density across internal and supplier route families; do not add margins around clutter without reorganizing it.
- Leave the existing localhost demo running during implementation; do not publish to `main` until the user reviews the result.
- Regulatory folders are a separate deliverable and are not part of this plan.

## Review Focus

1. Malformed or stale saved widths must fall back safely and not attach to a different column (Task 2 test).
2. A newly added/renamed/hidden column must leave other widths unchanged and appear in the same header row (Task 2 test).
3. Long words, multiline text and a failed save must remain readable/editable without losing the draft (Task 3 tests).
4. Zoom/pan must never expose an infinite blank area or hijack a field, selection or resize drag (Task 4 tests).
5. Narrow screens, reduced motion and browser text zoom must retain accessible controls and ordinary scrolling (Task 1 and 4 checks).

---

### Task 1: Shared visual foundation

**Files:** Modify `src/app/globals.css`, `src/app/(internal)/layout.tsx`, `src/features/projects/project-frame.ts`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/table.tsx`, `src/components/ui/empty-state.tsx`, `src/app/(internal)/projects/[projectId]/tasks/page.tsx`, `src/features/tasks/plan-list.tsx`; create `tests/unit/ui-foundation.test.tsx`.

**Interfaces:** Consumes existing `PROJECT_GUTTER`, `Button`, `Input`, `EmptyState`, and Plan page. Produces the same public component props and a consistent page/container style; no business-data interface changes.

- [ ] **Step 1: Write failing tests.** In `ui-foundation.test.tsx`, static-render `PlanList` and assert it has `role="region"` and `aria-label="Plano de trabalho"`; static-render `Button`, `Input` and `EmptyState` and assert existing labels/actions remain present. Add a browser assertion for 24/16 px gutters and reduced-motion behavior to Task 5.
- [ ] **Step 2: Confirm failure.** Run `npx vitest run tests/unit/ui-foundation.test.tsx`; the new workspace/style assertions fail.
- [ ] **Step 3: Implement.** Use existing design tokens, restrained radii/shadows and aligned typography; remove duplicate gutters, ensure 24/16 px page spacing, lighten table separators and group primary/secondary actions. Preserve existing component exports and server page behavior.
- [ ] **Step 4: Verify.** Run `npx vitest run tests/unit/ui-foundation.test.tsx`, `npm run typecheck`, and `npm run lint`; all pass.
- [ ] **Step 5: Commit** only Task 1 files on the feature branch with message `refactor: unify Vionex workspace styling`.

### Task 2: Stable, resizable Plan columns

**Files:** Create `src/features/tasks/plan-widths.ts` and `tests/unit/plan-widths.test.ts`; modify `src/features/tasks/plan-list.tsx` and `tests/unit/plan-value-cell.test.tsx`.

**Interfaces:** Produce `type PlanWidthMap = Record<string, number>`, `planColumnKeys(columns: PlanColumn[]): string[]` with built-in keys `task`, `assignee`, `due`, `priority` and custom `column.id`, `readPlanWidths(projectId: string, keys: string[], raw: string | null): PlanWidthMap`, and `resizePlanWidth(widths: PlanWidthMap, key: string, delta: number): PlanWidthMap`. Task 4 consumes the table's computed total width; existing `PlanList` props stay unchanged.

- [ ] **Step 1: Write failing tests.** Assert corrupt JSON/default values are safe; a legacy numeric-array preference is ignored; stable IDs survive rename/reorder/hide/add; each built-in/custom width respects a documented minimum; `<PlanList>` renders a keyboard-focusable resize handle on every header boundary and a new custom header in the same row.
- [ ] **Step 2: Confirm failure.** Run `npx vitest run tests/unit/plan-widths.test.ts tests/unit/plan-value-cell.test.tsx`; new assertions fail.
- [ ] **Step 3: Implement.** Replace index-based width arrays with project-scoped ID maps in localStorage. Make task column explicit (not `1fr`), add visible header handles with pointer capture and ArrowLeft/ArrowRight keyboard resizing; keep category headings spanning the full table width without fake data cells.
- [ ] **Step 4: Verify.** Run the two targeted test files and `npm run typecheck`; all pass.
- [ ] **Step 5: Commit** Task 2 files with message `feat: persist resizable plan columns by id`.

### Task 3: Readable, resilient inline cells

**Files:** Create `src/features/tasks/inline-edit.ts` and `tests/unit/inline-edit.test.ts`; modify `src/features/tasks/plan-value-cell.tsx`, `src/features/tasks/inline-task-title-cell.tsx`, `src/features/tasks/plan-list.tsx`, `tests/unit/plan-value-cell.test.tsx`; create `tests/unit/inline-task-title-cell.test.tsx`.

**Interfaces:** Produce `saveInlineDraft(draft: string, saved: string, submit: (value: string) => Promise<{error?: string}>): Promise<{draft: string; saved: string; error: string | null}>`; preserve `PlanValueCell`/`InlineTaskTitleCell` props and existing server actions. TEXT values and titles use auto-growing multiline editors; typed controls remain.

- [ ] **Step 1: Write failing tests.** Assert long read-only text has wrap/break styling rather than truncation; TEXT/title static-render multiline editors with accessible names; `saveInlineDraft` keeps the draft and error on rejection, updates saved value on success, and skips unchanged text. Cover Enter/Ctrl+Enter/Escape behavior in Task 5 browser checks.
- [ ] **Step 2: Confirm failure.** Run `npx vitest run tests/unit/plan-value-cell.test.tsx tests/unit/inline-task-title-cell.test.tsx`; new assertions fail.
- [ ] **Step 3: Implement.** Use an auto-height textarea for TEXT/title, content-width wrapping for display, and row `min-height` rather than fixed height. Keep draft during pending/error, retry in place, and avoid row-click/navigation conflicts.
- [ ] **Step 4: Verify.** Run targeted tests and `npm run typecheck`; all pass.
- [ ] **Step 5: Commit** Task 3 files with message `feat: wrap and edit plan text in place`.

### Task 4: Bounded Plan navigation

**Files:** Create `src/features/tasks/plan-viewport.ts`, `src/features/tasks/plan-workspace.tsx`, `tests/unit/plan-viewport.test.ts`, and `tests/unit/plan-workspace.test.tsx`; modify `src/app/(internal)/projects/[projectId]/tasks/page.tsx` and `src/features/tasks/plan-list.tsx`.

**Interfaces:** `clampPlanZoom(value: number): number` clamps to 70–150 on 10-point steps; `clampPlanOffset(offset: {x:number;y:number}, content: {width:number;height:number}, viewport: {width:number;height:number}, zoom: number): {x:number;y:number}` bounds movement; `shouldStartPlanPan(button: number, spaceHeld: boolean, interactiveTarget: boolean): boolean` guards controls. `PlanWorkspace({projectId, children}: {projectId:string; children:React.ReactNode})` wraps the toolbar/table without moving the project header or tabs.

- [ ] **Step 1: Write failing tests.** Assert zoom bounds/steps, smaller-than-viewport content locks offset at zero, oversized content clamps both axes, reset returns zoom 100 and top-left, and pan starts only from blank surface with Space+drag or middle-button—not controls, text, menu or resize handles.
- [ ] **Step 2: Confirm failure.** Run `npx vitest run tests/unit/plan-viewport.test.ts tests/unit/plan-workspace.test.tsx`; tests fail.
- [ ] **Step 3: Implement.** Add explicit zoom/reset controls and bounded desktop pan; wheel/trackpad remain normal scrolling. Keep horizontal scrollbar and mobile 100% ordinary scroll. Persist only zoom preference per project; contain overscroll and respect reduced motion.
- [ ] **Step 4: Verify.** Run targeted tests, `npm run typecheck`, and `npm run lint`; all pass.
- [ ] **Step 5: Commit** Task 4 files with message `feat: add bounded plan workspace navigation`.

### Task 5: Page-wide hierarchy and action placement

**Files:** Modify `src/components/app/page-header.tsx`, `src/components/app/view-toolbar.tsx`, `src/features/projects/work-block.tsx`, `src/app/(supplier)/supplier/layout.tsx`, `src/app/(internal)/projects/[projectId]/page.tsx`, `src/app/(supplier)/supplier/action-required/[requestId]/page.tsx`, `src/app/(internal)/documents/page.tsx`, `src/app/(supplier)/supplier/documents/page.tsx`; create `tests/unit/page-hierarchy.test.tsx`.

**Interfaces:** Preserve existing component props, route data, permissions and actions. Shared headers/toolbars must wrap actions cleanly; WorkBlock rows must permit content wrapping; supplier/internal shells share the 24/16 px gutter rule.

- [ ] **Step 1: Write failing tests.** Static-render `PageHeader`, `ViewToolbar` and `WorkBlock` with multiple actions/long labels and assert one clear primary action group, accessible labels and no truncation class on important content. Cover route-family visual assertions in Task 6.
- [ ] **Step 2: Confirm failure.** Run `npx vitest run tests/unit/page-hierarchy.test.tsx`; new assertions fail.
- [ ] **Step 3: Implement.** Group actions by the content they affect, keep one page identity, put secondary metadata below or behind existing disclosures, and normalize responsive gutters/spacing. Reuse `PageHeader`/`Section`/`Panel`; do not duplicate cards or change workflows.
- [ ] **Step 4: Verify.** Run targeted tests, `npm run typecheck` and `npm run lint`; all pass.
- [ ] **Step 5: Commit** Task 5 files with message `refactor: clarify page hierarchy across internal and supplier views`.

### Task 6: Release verification and local review

**Files:** Test-only adjustments if regressions are found; no new product scope.

**Interfaces:** Consumes Tasks 1–4. Produces a tested local demo on a separate port while the current demo stays available.

- [ ] **Step 1: Run full checks.** `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration` against the local database, and a demo-mode Webpack production build; require all to pass.
- [ ] **Step 2: Browser-check.** At desktop and narrow widths, verify Plan add/edit column/row, long text, resizing with mouse/keyboard, zoom/pan/reset, menus, no blank overscroll/sidebar cut-off, and representative internal/supplier pages including document upload.
- [ ] **Step 3: Fix and recheck** any failure in its owning task, then rerun the affected tests and full checks.
- [ ] **Step 4: Open the updated localhost demo** for the user, share its link and remaining limitations; do not push `main` without a separate release decision.
