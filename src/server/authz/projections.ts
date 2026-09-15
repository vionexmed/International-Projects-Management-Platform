import type { Prisma } from "@/generated/prisma";

/**
 * What a supplier is allowed to receive.
 *
 * Scopes decide *which rows* a caller may see. These decide *which columns* —
 * a separate question that the scopes cannot answer, because a supplier is
 * legitimately entitled to the row for their own project and still has no
 * business reading the column where Vionex wrote down what it thinks of them.
 *
 * The fields are listed by inclusion, never by exclusion. An allowlist fails
 * safe: a column added to the schema tomorrow is invisible to suppliers until
 * somebody names it here on purpose. A denylist would leak it by default.
 *
 * Kept out deliberately, and the reason for each:
 *
 *   Project.description   free text describing the project internally
 *   Project.blockerNote   why Vionex considers the project blocked
 *   Project.ownerId       who inside Vionex owns it, and the owner relation
 *   ProjectStage.notes    running internal commentary on each stage
 *   Milestone.description detail written for the internal team
 *
 * These reach the browser through the RSC payload whether or not a component
 * renders them, so not rendering a field is not the same as not sending it.
 */

export const SUPPLIER_PROJECT_SELECT = {
  id: true,
  organizationId: true,
  supplierId: true,
  name: true,
  projectCode: true,
  country: true,
  productType: true,
  category: true,
  status: true,
  currentStage: true,
  startDate: true,
  targetLaunchDate: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: { id: true, name: true, country: true, status: true } },
} satisfies Prisma.ProjectSelect;

export const SUPPLIER_STAGE_SELECT = {
  id: true,
  projectId: true,
  key: true,
  name: true,
  position: true,
  status: true,
  progress: true,
  startDate: true,
  dueDate: true,
} satisfies Prisma.ProjectStageSelect;

export const SUPPLIER_MILESTONE_SELECT = {
  id: true,
  projectId: true,
  title: true,
  stage: true,
  dueDate: true,
  status: true,
  position: true,
  completedAt: true,
} satisfies Prisma.MilestoneSelect;

/**
 * The columns a supplier must never receive, named so a test can assert their
 * absence instead of trusting that the selects above stayed correct.
 */
export const INTERNAL_ONLY_FIELDS = {
  project: ["description", "blockerNote", "ownerId", "owner"],
  projectStage: ["notes"],
  milestone: ["description"],
} as const;

export type SupplierProject = Prisma.ProjectGetPayload<{
  select: typeof SUPPLIER_PROJECT_SELECT;
}>;
export type SupplierStage = Prisma.ProjectStageGetPayload<{
  select: typeof SUPPLIER_STAGE_SELECT;
}>;
export type SupplierMilestone = Prisma.MilestoneGetPayload<{
  select: typeof SUPPLIER_MILESTONE_SELECT;
}>;
