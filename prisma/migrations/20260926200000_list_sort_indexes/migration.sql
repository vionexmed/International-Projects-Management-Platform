-- Indexes that match the hot list queries' filter + sort, so the portfolio,
-- task, document and notification lists stop sorting in memory as they grow.

-- DropIndex (superseded: (organizationId, status) is a prefix of the new one)
DROP INDEX "Task_organizationId_status_idx";

-- CreateIndex
CREATE INDEX "Task_organizationId_status_dueDate_idx" ON "Task"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Project_organizationId_updatedAt_idx" ON "Project"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_organizationId_updatedAt_idx" ON "Document"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
