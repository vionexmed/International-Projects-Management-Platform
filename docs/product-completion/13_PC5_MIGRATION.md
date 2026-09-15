# PC-5 — Schema / Data Model Completion

**Migration:** `20260915111827_review_history_and_attachments`
**Applied to:** local development database only (`migrate deploy`). Never production, never staging, never Supabase.
**Historical migrations touched:** none. `20260902195200_init` and `20260909155300_login_throttle` are byte-identical to what they were before this round.

---

## 1. Why

Two things the product needed and could not express in storage.

**The review history.** `DocumentRequest.reviewNote` held one string. Every new decision overwrote the previous one, so a request that went rejected → resubmitted → approved ended with no record that the rejection had ever happened, and none of *who* decided, *on which file*, or *when*. For a regulatory file that is the part that matters. PC-2 kept the reason readable by writing it into the conversation (`DocumentRequestReply`), which is honest but unstructured: you cannot query it, count it, or be sure a row is a verdict rather than a comment.

**Attachments on messages.** A message was text only. In practice a conversation about a shipment is a conversation *about a file*, and the file had to be uploaded separately in Documents and referred to by name.

A third, smaller thing: `DocumentRequestReply.authorId` had no foreign key, so the author could not be joined and the UI showed anonymous lines.

## 2. Pre-migration audit

Run before writing any SQL, read-only:

| Check | Result |
|---|---|
| `DocumentRequestReply.authorId` values with no matching `User` | **0** — the column could take a foreign key without a repair step |
| Rows that would violate any new constraint | **0** |
| Existing `DocumentRequest` rows | 4 |
| Existing `DocumentRequestReply` rows | 1 |
| Existing `Message` rows | 5 |
| Existing `DocumentVersion` rows | 11 |

No incompatible data was found, so nothing had to be deleted, corrected, or invented. Had there been an orphan `authorId`, the round would have stopped before the migration rather than fabricate a user.

## 3. What changed in the schema

**Added — `ReviewDecision` enum:** `APPROVED`, `CHANGES_REQUESTED`.

**Added — `DocumentRequestReview`:** one row per decision. `requestId` (cascade), `documentVersionId` (nullable, restrict — the exact file judged), `reviewerId` (restrict), `decision`, `note`, `createdAt`. Indexed on `(requestId, createdAt)`, `reviewerId`, `documentVersionId`.

**Added — `MessageAttachment`:** `messageId` (cascade), `documentVersionId` (restrict), unique on `(messageId, documentVersionId)`.

**Added — foreign key on `DocumentRequestReply.authorId` → `User.id`** (restrict), plus its index.

Nothing was removed, renamed, widened, narrowed, or made nullable. No column changed type. No default changed on an existing column.

### Why an attachment points at `DocumentVersion`

The alternative was a second file table with its own path and its own access check. Two authorisations eventually disagree, and the one that disagrees in the wrong direction leaks a file. Pointing at `DocumentVersion` keeps `/api/files/[versionId]` the single authenticated download path for every file in the product: same session check, same scope, same audit entry. No binary lives in Postgres and no second storage pipeline exists.

Attachment visibility follows the thread: a file on a supplier thread is uploaded `SHARED_WITH_SUPPLIER`, one on an internal thread `INTERNAL_ONLY`. A supplier reaching an internal attachment is refused twice over — the thread is out of scope, and so is the document.

## 4. The SQL

`prisma/migrations/20260915111827_review_history_and_attachments/migration.sql`, generated with `--create-only` and read line by line before being applied. It contains:

- 1 × `CREATE TYPE`
- 2 × `CREATE TABLE`
- 6 × `CREATE INDEX`
- 6 × `ADD CONSTRAINT`

and **0** × `DROP`, `TRUNCATE`, `ALTER COLUMN`, `SET NOT NULL`, or any data statement (`INSERT` / `UPDATE` / `DELETE`). It is additive and forward-only.

## 5. Risk, and how it was contained

| Risk | Containment |
|---|---|
| A new foreign key rejects existing rows | Audited first: 0 orphans. Verified again on a disposable copy. |
| The migration is destructive by accident | Generated `--create-only`, inspected, then grepped for every destructive keyword. |
| It works on an empty database and not on this one | Applied to a throwaway database first (13/13 structural checks), then to the dev database with row counts compared before and after. |
| Existing data lost | Counts identical after `migrate deploy`: 4 requests, 1 reply, 5 messages, 11 versions. |

## 6. Application result

`prisma migrate deploy` on the local development database, followed by `prisma generate`. One migration applied, no history rewritten, no reset, no data touched.

## 7. What was *not* reconstructed

Reviews that happened before this table existed were **not** back-filled. The system does not hold enough information to say who decided or against which version, and a fabricated reviewer in a regulatory history is worse than a gap. The history starts at this migration and is honest about it.

## 8. Tests

`tests/integration/review-history-and-attachments.test.ts` — 10 tests:

- a rejection is recorded against the version it judged, with reviewer and note
- a second decision **adds** a round rather than replacing the first
- a request nobody has decided has no rounds invented for it
- the supplier reads decision, note and date — the reviewer is never selected for a portal session
- another supplier is refused the history entirely
- a message carries its file, and both sides of the conversation can download it
- **a different supplier holding the attachment's id is refused** — the scope is inside the lookup, not on the screen
- a message with neither text nor file is refused
- an internal thread's attachment stays `INTERNAL_ONLY` and is invisible to the supplier through both doors

Full suite after the round: **111 integration + 81 unit passing**, lint clean, typecheck clean, `next build` clean.

## 9. Operational rollback

Forward-only by policy; there is no down migration. If the tables had to go, the manual sequence on an authorised non-production database would be `DROP TABLE "MessageAttachment"; DROP TABLE "DocumentRequestReview"; DROP TYPE "ReviewDecision";` plus dropping the `DocumentRequestReply_authorId_fkey` constraint — all of which destroy the history this round exists to keep, so it is a last resort and not a routine.

## 10. Boundary of this round

Not done, deliberately: no production configuration, no staging, no deploy, no Supabase, no external database, `DATABASE_URL` unchanged. PC-6 not started.

Still open and **not** silently resolved: **PERM-1** (`project:update` is broader than it should be), **PERM-2** (`document:review` for IMPORT / MARKETING), **PERM-4** (internal `VIEWER` against `INTERNAL_ONLY` documents).
