-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL,
    "standard_shipping_rate" INTEGER NOT NULL DEFAULT 25000,
    "express_shipping_rate" INTEGER NOT NULL DEFAULT 50000,
    "free_shipping_threshold" INTEGER NOT NULL DEFAULT 500000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);
