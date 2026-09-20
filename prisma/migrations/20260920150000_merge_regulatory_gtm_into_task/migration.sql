-- Fase 3 of the architecture-simplification plan: `RegulatoryItem` and
-- `GtmItem` were their own tables from the start, shaped exactly like a task
-- (title, status, due date) plus a couple of fields genuinely their own
-- (`authority`, `requestedFrom`, GTM's `category`). Neither ever gained a
-- real owner, comments, notifications or a place in `/tasks` — adding those
-- to two more tables was always the wrong direction. This migration folds
-- every row of both into `Task`, where that machinery already exists, and
-- drops the two tables.
--
-- Status mapping. `Task.status` is `ProgressStatus`; both source tables used
-- `RegulatoryItem`'s six-value document-cycle vocabulary and GTM's own
-- four-value one (Fase 2 unified their *names* into shared enums without
-- touching what each model actually stored). The mapping below is not new:
-- it is the exact projection `stageWorkAsTasks()` in
-- `src/server/services/project-health.ts` has used since Fase 1 to fold this
-- same work into progress and status calculations without merging the
-- tables. Using it again here means a regulatory item that read "in
-- progress" the day before this migration reads "in progress" the day after
-- it, as a real task.
--   RegulatoryItem: PENDING, REQUESTED -> OPEN · RECEIVED, IN_REVIEW ->
--     IN_PROGRESS · APPROVED -> COMPLETED · REJECTED -> WAITING
--   GtmItem: NOT_STARTED -> OPEN · IN_PROGRESS -> IN_PROGRESS · COMPLETED ->
--     COMPLETED · BLOCKED -> WAITING
-- The two RegulatoryItem collapses (PENDING/REQUESTED, RECEIVED/IN_REVIEW)
-- are the only values genuinely lost, and only from the *live* status field:
-- every status change either model ever made is already a sentence in the
-- project's timeline (`recordTimelineEvent`, unaffected by this migration),
-- so the finer history is not deleted, only no longer the live value.
--
-- `ownerName`/`owner` were always free text, never a real account — the
-- opposite of `assignedToId`, which is what this migration is partly *for*.
-- Audited against the local development database before this file was
-- written: every one of the 8 non-null values (7 `RegulatoryItem`, 1 shared
-- `GtmItem` owner across 16 rows) matches a `User.name` in the same
-- organisation exactly. The INSERTs below resolve that match at migration
-- time, restricted to `supplierId IS NULL` — both fields were always labelled
-- "Vionex" ownership, and matching into the same organisation alone would let
-- a supplier contact who happens to share a name with the intended person be
-- assigned an internal task instead. A name with no matching internal
-- account keeps `assignedToId` null and is appended to `description`
-- instead, so a real name is never silently dropped.
--
-- `createdById` is required on `Task` and neither source table ever recorded
-- who created a row, so migrated rows are attributed to the project's own
-- `ownerId` — a real account, and the closest honest answer to "whose work
-- is this of record" available.
--
-- `completedAt` is set from `updatedAt` only for rows already in a terminal
-- state (`APPROVED`/`COMPLETED`): both tables' only write path
-- (`updateRegulatoryItemAction`/`updateGtmItemAction`) touches nothing but
-- `status`, so for a row currently approved or completed, `updatedAt` is the
-- moment it became so. Every other row gets `completedAt = NULL` rather than
-- a fabricated timestamp.
--
-- `position` (GtmItem's manual ordering) is not migrated: nothing ever wrote
-- to it after creation (no reorder action exists), and in every seeded row it
-- is exactly the category's declaration order — dropping it and sorting by
-- category then due date reproduces the same order with one fewer column.
--
-- Tested end to end on a disposable clone of the local development database
-- before being applied here: row counts, status values, resolved
-- `assignedToId` matches and `authority`/`requestedFrom`/`gtmCategory`
-- carried over were compared against the source tables with zero mismatches.

-- AlterTable: Task gains what was genuinely specific to each source table.
ALTER TABLE "Task" ADD COLUMN "authority" TEXT;
ALTER TABLE "Task" ADD COLUMN "requestedFrom" TEXT;
ALTER TABLE "Task" ADD COLUMN "gtmCategory" "GtmCategory";

-- Migrate RegulatoryItem rows into Task.
INSERT INTO "Task" (
  "id", "organizationId", "projectId", "assignedToId", "createdById", "supplierId",
  "title", "description", "category", "priority", "status", "dueDate", "completedAt",
  "createdAt", "updatedAt", "authority", "requestedFrom", "gtmCategory"
)
SELECT
  ri."id",
  p."organizationId",
  ri."projectId",
  (
    SELECT u."id" FROM "User" u
    WHERE u."organizationId" = p."organizationId"
      AND u."supplierId" IS NULL
      AND ri."ownerName" IS NOT NULL
      AND lower(trim(u."name")) = lower(trim(ri."ownerName"))
    LIMIT 1
  ) AS "assignedToId",
  p."ownerId" AS "createdById",
  NULL AS "supplierId",
  ri."title",
  CASE
    WHEN ri."ownerName" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "User" u
      WHERE u."organizationId" = p."organizationId"
        AND u."supplierId" IS NULL
        AND lower(trim(u."name")) = lower(trim(ri."ownerName"))
    )
      THEN trim(both E'\n' from coalesce(ri."notes" || E'\n\n', '') || 'Responsável (não migrado): ' || ri."ownerName")
    ELSE ri."notes"
  END AS "description",
  'REGULATORY'::"TaskCategory" AS "category",
  'MEDIUM'::"TaskPriority" AS "priority",
  (CASE ri."status"::text
    WHEN 'PENDING' THEN 'OPEN'
    WHEN 'REQUESTED' THEN 'OPEN'
    WHEN 'RECEIVED' THEN 'IN_PROGRESS'
    WHEN 'IN_REVIEW' THEN 'IN_PROGRESS'
    WHEN 'APPROVED' THEN 'COMPLETED'
    WHEN 'REJECTED' THEN 'WAITING'
  END)::"ProgressStatus" AS "status",
  ri."dueDate",
  CASE WHEN ri."status" = 'APPROVED' THEN ri."updatedAt" ELSE NULL END AS "completedAt",
  ri."createdAt",
  ri."updatedAt",
  ri."authority",
  ri."requestedFrom",
  NULL AS "gtmCategory"
FROM "RegulatoryItem" ri
JOIN "Project" p ON p."id" = ri."projectId";

-- Migrate GtmItem rows into Task.
INSERT INTO "Task" (
  "id", "organizationId", "projectId", "assignedToId", "createdById", "supplierId",
  "title", "description", "category", "priority", "status", "dueDate", "completedAt",
  "createdAt", "updatedAt", "authority", "requestedFrom", "gtmCategory"
)
SELECT
  gi."id",
  p."organizationId",
  gi."projectId",
  (
    SELECT u."id" FROM "User" u
    WHERE u."organizationId" = p."organizationId"
      AND u."supplierId" IS NULL
      AND gi."owner" IS NOT NULL
      AND lower(trim(u."name")) = lower(trim(gi."owner"))
    LIMIT 1
  ) AS "assignedToId",
  p."ownerId" AS "createdById",
  NULL AS "supplierId",
  gi."title",
  CASE
    WHEN gi."owner" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "User" u
      WHERE u."organizationId" = p."organizationId"
        AND u."supplierId" IS NULL
        AND lower(trim(u."name")) = lower(trim(gi."owner"))
    )
      THEN trim(both E'\n' from coalesce(gi."detail" || E'\n\n', '') || 'Responsável (não migrado): ' || gi."owner")
    ELSE gi."detail"
  END AS "description",
  'GO_TO_MARKET'::"TaskCategory" AS "category",
  'MEDIUM'::"TaskPriority" AS "priority",
  (CASE gi."status"::text
    WHEN 'NOT_STARTED' THEN 'OPEN'
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
    WHEN 'COMPLETED' THEN 'COMPLETED'
    WHEN 'BLOCKED' THEN 'WAITING'
  END)::"ProgressStatus" AS "status",
  gi."dueDate",
  CASE WHEN gi."status" = 'COMPLETED' THEN gi."updatedAt" ELSE NULL END AS "completedAt",
  gi."createdAt",
  gi."updatedAt",
  NULL AS "authority",
  NULL AS "requestedFrom",
  gi."category" AS "gtmCategory"
FROM "GtmItem" gi
JOIN "Project" p ON p."id" = gi."projectId";

-- DropTable: every row has been migrated into Task above.
DROP TABLE "RegulatoryItem";
DROP TABLE "GtmItem";
