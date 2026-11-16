-- CreateTable
CREATE TABLE "Listing" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceText" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPersonal" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_token_key" ON "Listing"("token");

-- CreateIndex
CREATE INDEX "Listing_district_idx" ON "Listing"("district");
