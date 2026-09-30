# Vionex Workspace Refresh — Design

## Purpose and rollout

Make the internal and supplier experience feel like one calm, credible Vionex product, with the project plan as a dependable place to work rather than a collection of forms. The immediate release improves the shared visual system and the Plan. A separate follow-up will reorganize Regulatory documents by supplier and project; this release does not move files or change their permissions.

Success means a presenter can create and edit a task, read long field values, adjust column widths, navigate a large plan, and return to a known view without losing work. A supplier can still find requests and submit documents through the existing portal.

## Reference and identity

- Keep Vionex's teal, dark navigation rail and logo. Do not reproduce another brand's colors or identity.
- Use [shadcn/ui](https://github.com/shadcn-ui/ui) as a reference for composable, accessible component behavior; retain the project's existing Radix and Tailwind components instead of running a bulk installer.
- Use the Notion and Linear studies in [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md) for restrained hierarchy, content-first tables and spacing rhythm, adapted to Vionex.
- Use [Impeccable](https://github.com/pbakaus/impeccable) as a review checklist for typography, state clarity, contrast, wrapping, responsive layouts and keyboard use. These references inform decisions; their instructions do not override project requirements.

## Visual language

The page canvas is a soft neutral; primary work surfaces are white. Brand teal marks actions and selection, while semantic green, amber, red and blue retain their existing meanings. A 4/8/12/16/24/32 px spacing rhythm governs controls and sections. Desktop page content has at least 24 px between the workspace edge and content, mobile at least 16 px. Corners are restrained (roughly 8–14 px); shadows distinguish floating controls, not every section. Status never relies on color alone.

One title and one brief context line identify each page. The main action has clear priority; secondary controls are grouped nearby instead of repeated in boxes. Tables favor aligned text, light row separators and breathing room over heavy card borders. Body and metadata roles stay consistent across internal and supplier surfaces. Focus, hover, loading, disabled, empty and error states must be visible and predictable. Respect reduced motion and browser text zoom.

## Plan workspace

The project header and navigation remain outside the Plan workspace. The Plan toolbar and table form one bounded, clearly framed workspace with a stable reset control. It must not create an infinite blank canvas or let users lose the content. Conventional wheel/trackpad movement continues to navigate vertically; horizontal movement is available via trackpad or scrollbar. On desktop, explicit zoom controls change the plan between 70% and 150% (default 100%) in 10% steps. Space+drag or middle-button drag pans only the plan surface; dragging an editable cell, menu, text selection or resize handle retains its normal behavior. A reset action restores 100% zoom and the top-left position. Pan is bounded by the content, with overscroll contained. On touch and narrow screens, use conventional scrolling and 100% layout rather than a fragile gesture mode.

The list remains the single primary view; there is no separate board required. Category headings are visually distinct through type and spacing, but not another grid of data cells. Rows stay white and expand vertically when content needs two or more lines. Text columns display complete wrapped values, including long words or links, and edit directly in the cell with an auto-growing field. Dates, numbers, people, priority and status keep appropriate inline controls. Do not shrink essential text to unreadable sizes or hide it behind unexplained ellipses.

Every column boundary, including the task-name boundary, has a discoverable resize handle in the header. Pointer drag changes the width immediately; keyboard arrows on a focused handle change it in small steps. Minimum widths prevent unusable cells. Widths persist per project and stable column identifier, so adding, hiding, reordering or renaming a column does not displace stored widths. A newly added column appears in the same header row immediately, without a reload.

The existing server actions, permission checks, task schema and document-request flow remain authoritative. View preferences (zoom and widths) may be stored in browser storage, but task and column values remain in the database. A failed save retains the user's draft and offers an actionable error; no silent data loss.

## Shared components and rollout boundary

The first implementation updates design tokens and shared page/container, button, table, input, menu and empty-state patterns where they serve the design. It applies them to the internal project Plan and verifies representative internal and supplier pages. It must not blindly rewrite every page or introduce a second full UI framework. Subsequent page-by-page work can adopt the same system without changing business logic.

The Regulatory folder view is a second deliverable: supplier → project → regulatory documents, backed by existing document relationships and authorization. It will be specified and tested separately. No physical storage paths or records change merely to produce folders.

## Verification and release

- Unit checks cover width preference migration/reordering, zoom bounds and text-cell save behavior.
- Integration checks confirm column and task edits remain scoped to the project and stage progress remains correct.
- Browser checks at desktop and narrow widths cover long text, resize, pan/zoom/reset, inline editing, menus, keyboard focus, supplier upload and no white overscroll/sidebar breakage.
- Typecheck, lint, unit/integration tests and a production build pass before a release. The localhost demo remains available for review; publishing to `main` is a separate, explicit final step.
