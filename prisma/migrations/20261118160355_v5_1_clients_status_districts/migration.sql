-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "areaSqm" DOUBLE PRECISION,
ADD COLUMN     "imageUrls" JSONB,
ADD COLUMN     "saleAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "maxDeposit" DOUBLE PRECISION,
    "maxRent" DOUBLE PRECISION,
    "district" TEXT,
    "wantsParking" BOOLEAN NOT NULL DEFAULT false,
    "wantsStorage" BOOLEAN NOT NULL DEFAULT false,
    "wantsElevator" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingStatus" (
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingStatus_pkey" PRIMARY KEY ("token")
);
