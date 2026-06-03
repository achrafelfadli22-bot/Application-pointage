-- Add attachment fields to LeaveRequest for MinIO document upload support

ALTER TABLE "LeaveRequest"
  ADD COLUMN "attachmentKey" TEXT,
  ADD COLUMN "attachmentUrl" TEXT;
