# Humanize Supplier Flow Design

## Goal

Make the supplier portal feel more intentional while ensuring a supplier who opens a task can immediately send the requested file.

## Decisions

- A generic supplier task opens that project's Documents tab with its upload dialog open.
- Uploading a generic task attachment does not mark the task complete. Formal document requests retain their request/review lifecycle and existing completion rule.
- The internal task form clearly distinguishes a supplier-visible task from a formal document request.
- Visual changes stay token-level and focal-only: modest panel elevation, softer focal geometry, and clearer hierarchy. No data model, authorization, or navigation restructure.

## Verification

- Regression test asserts generic queue tasks use the document-upload destination while formal requests retain their dedicated destination.
- Typecheck, lint, unit/integration tests, and a local supplier-portal smoke check must pass.
