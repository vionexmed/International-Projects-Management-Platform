CREATE TYPE "PlanColumnType" AS ENUM ('TEXT', 'SELECT', 'DATE', 'NUMBER', 'PERSON');

CREATE TABLE "ProjectPlanColumn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanColumnType" NOT NULL,
    "position" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectPlanColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskPlanValue" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskPlanValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectPlanColumn_projectId_key_key" ON "ProjectPlanColumn"("projectId", "key");
CREATE INDEX "ProjectPlanColumn_projectId_position_idx" ON "ProjectPlanColumn"("projectId", "position");
CREATE UNIQUE INDEX "TaskPlanValue_taskId_columnId_key" ON "TaskPlanValue"("taskId", "columnId");
CREATE INDEX "TaskPlanValue_columnId_idx" ON "TaskPlanValue"("columnId");

ALTER TABLE "ProjectPlanColumn" ADD CONSTRAINT "ProjectPlanColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskPlanValue" ADD CONSTRAINT "TaskPlanValue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskPlanValue" ADD CONSTRAINT "TaskPlanValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "ProjectPlanColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
