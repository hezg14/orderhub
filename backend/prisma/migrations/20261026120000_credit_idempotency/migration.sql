-- Credit control + idempotent order creation.
--
-- 1. customers.credit_limit: open-credit ceiling in CNY. Nullable — NULL means
--    the customer is not under credit control (cash customer). The enforcement
--    lives in order.service.createOrder, inside the same transaction that locks
--    the stock rows, so concurrent orders cannot both pass the check.
-- 2. idempotency_keys: client-supplied Idempotency-Key stored in the same
--    transaction as the order it produced. A replayed request finds the key and
--    gets the original order back instead of creating a duplicate.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "credit_limit" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
