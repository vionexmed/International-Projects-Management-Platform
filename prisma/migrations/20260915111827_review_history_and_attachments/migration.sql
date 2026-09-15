-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "DocumentRequestReview" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "documentVersionId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRequestReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRequestReview_requestId_createdAt_idx" ON "DocumentRequestReview"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRequestReview_reviewerId_idx" ON "DocumentRequestReview"("reviewerId");

-- CreateIndex
CREATE INDEX "DocumentRequestReview_documentVersionId_idx" ON "DocumentRequestReview"("documentVersionId");

-- CreateIndex
CREATE INDEX "MessageAttachment_documentVersionId_idx" ON "MessageAttachment"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_messageId_documentVersionId_key" ON "MessageAttachment"("messageId", "documentVersionId");

-- CreateIndex
CREATE INDEX "DocumentRequestReply_authorId_idx" ON "DocumentRequestReply"("authorId");

-- AddForeignKey
ALTER TABLE "DocumentRequestReply" ADD CONSTRAINT "DocumentRequestReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestReview" ADD CONSTRAINT "DocumentRequestReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestReview" ADD CONSTRAINT "DocumentRequestReview_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestReview" ADD CONSTRAINT "DocumentRequestReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
