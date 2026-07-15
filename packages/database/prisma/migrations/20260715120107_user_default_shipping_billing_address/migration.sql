-- AlterTable
ALTER TABLE "users" ADD COLUMN     "default_billing_address_id" TEXT,
ADD COLUMN     "default_shipping_address_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_shipping_address_id_fkey" FOREIGN KEY ("default_shipping_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_billing_address_id_fkey" FOREIGN KEY ("default_billing_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
