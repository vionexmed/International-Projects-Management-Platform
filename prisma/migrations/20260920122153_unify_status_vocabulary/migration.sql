-- Fase 2 of the architecture-simplification plan: ten columns across ten
-- tables each declared their own near-duplicate status enum. Three of those
-- pairs were byte-identical (StageStatus/GtmItemStatus, DocumentStatus/
-- RegulatoryItemStatus), and most of the rest overlapped in three of their
-- four or six values. This migration replaces the ten with three shared
-- enums, each a *pure union* of the values the enums it replaces already
-- had — no value is renamed, split or merged, so every stored row keeps the
-- exact word it already had.
--
-- Audited against every row in the local development database before this
-- file was written: all 92 status values currently stored across the ten
-- columns already belong to their destination enum, so every ALTER COLUMN
-- below is a same-value cast, never a remapping. See
-- docs/product-freeze/... (Fase 2 write-up) for the full audit and for the
-- values deliberately kept apart rather than merged (see the doc comments on
-- each enum in schema.prisma): RECEIVED/SUBMITTED, and NOT_STARTED/PLANNED/
-- OPEN, along with BLOCKED/DELAYED/SUSPENDED/WAITING.
--
-- No column is dropped and no data is rewritten to a different value at any
-- point. The ten old enum *type declarations* are dropped at the end, once
-- nothing references them — they hold no rows themselves, only the vocabulary
-- itself, which is why dropping them is not a data-destructive operation in
-- the sense the rest of this project's migration rules are about.

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DocumentCycleStatus" AS ENUM ('PENDING', 'REQUESTED', 'RECEIVED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'PLANNED', 'OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DELAYED', 'SUSPENDED', 'COMPLETED', 'CANCELLED');

-- AlterColumn: Supplier.status  SupplierStatus -> HealthStatus
ALTER TABLE "Supplier" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "status" TYPE "HealthStatus" USING ("status"::text::"HealthStatus");
ALTER TABLE "Supplier" ALTER COLUMN "status" SET DEFAULT 'ON_TRACK';

-- AlterColumn: Project.status  ProjectStatus -> HealthStatus
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "HealthStatus" USING ("status"::text::"HealthStatus");
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'ON_TRACK';

-- AlterColumn: ProjectStage.status  StageStatus -> ProgressStatus
ALTER TABLE "ProjectStage" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProjectStage" ALTER COLUMN "status" TYPE "ProgressStatus" USING ("status"::text::"ProgressStatus");
ALTER TABLE "ProjectStage" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

-- AlterColumn: Task.status  TaskStatus -> ProgressStatus
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "ProgressStatus" USING ("status"::text::"ProgressStatus");
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterColumn: Document.status  DocumentStatus -> DocumentCycleStatus
ALTER TABLE "Document" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Document" ALTER COLUMN "status" TYPE "DocumentCycleStatus" USING ("status"::text::"DocumentCycleStatus");
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- AlterColumn: DocumentRequest.status  RequestStatus -> DocumentCycleStatus
ALTER TABLE "DocumentRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DocumentRequest" ALTER COLUMN "status" TYPE "DocumentCycleStatus" USING ("status"::text::"DocumentCycleStatus");
ALTER TABLE "DocumentRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterColumn: Milestone.status  MilestoneStatus -> ProgressStatus
ALTER TABLE "Milestone" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Milestone" ALTER COLUMN "status" TYPE "ProgressStatus" USING ("status"::text::"ProgressStatus");
ALTER TABLE "Milestone" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

-- AlterColumn: ClinicalStudy.status  ClinicalStudyStatus -> ProgressStatus
ALTER TABLE "ClinicalStudy" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ClinicalStudy" ALTER COLUMN "status" TYPE "ProgressStatus" USING ("status"::text::"ProgressStatus");
ALTER TABLE "ClinicalStudy" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

-- AlterColumn: RegulatoryItem.status  RegulatoryItemStatus -> DocumentCycleStatus
ALTER TABLE "RegulatoryItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RegulatoryItem" ALTER COLUMN "status" TYPE "DocumentCycleStatus" USING ("status"::text::"DocumentCycleStatus");
ALTER TABLE "RegulatoryItem" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterColumn: GtmItem.status  GtmItemStatus -> ProgressStatus
ALTER TABLE "GtmItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GtmItem" ALTER COLUMN "status" TYPE "ProgressStatus" USING ("status"::text::"ProgressStatus");
ALTER TABLE "GtmItem" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

-- DropEnum: the ten old types, now referenced by nothing. No rows are held by
-- a type declaration itself, so this drops vocabulary, not data.
DROP TYPE "SupplierStatus";
DROP TYPE "ProjectStatus";
DROP TYPE "StageStatus";
DROP TYPE "TaskStatus";
DROP TYPE "DocumentStatus";
DROP TYPE "RequestStatus";
DROP TYPE "MilestoneStatus";
DROP TYPE "ClinicalStudyStatus";
DROP TYPE "RegulatoryItemStatus";
DROP TYPE "GtmItemStatus";
