/*
  Warnings:

  - You are about to drop the `ListingStatus` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "propertyKind" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "ListingStatus";
