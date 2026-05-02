-- AlterTable: add nullable FK from Patient to Coordinator
ALTER TABLE "Patient" ADD COLUMN "assignedCoordinatorId" TEXT;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_assignedCoordinatorId_fkey"
  FOREIGN KEY ("assignedCoordinatorId") REFERENCES "Coordinator"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
