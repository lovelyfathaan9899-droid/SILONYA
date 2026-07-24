-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('cod', 'online');

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "fullName" TEXT,
ALTER COLUMN "postal_code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "carts" ALTER COLUMN "currency" SET DEFAULT 'PKR';

-- AlterTable
ALTER TABLE "gift_cards" ALTER COLUMN "currency" SET DEFAULT 'PKR';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_note" TEXT,
ADD COLUMN     "payment_method" "OrderPaymentMethod" NOT NULL DEFAULT 'cod',
ADD COLUMN     "shipping_method" TEXT NOT NULL DEFAULT 'standard',
ALTER COLUMN "currency" SET DEFAULT 'PKR';

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'PKR';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'PKR';
