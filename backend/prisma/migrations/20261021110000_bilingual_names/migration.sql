-- Bilingual display names: the demo dataset is Chinese-first, and the UI needs
-- locale-appropriate labels for the English surface. Nullable so real records
-- without translations keep working; the API falls back to the primary name.
ALTER TABLE "users" ADD COLUMN "name_en" TEXT;
ALTER TABLE "customers" ADD COLUMN "name_en" TEXT;
ALTER TABLE "customers" ADD COLUMN "company_en" TEXT;
ALTER TABLE "products" ADD COLUMN "name_en" TEXT;
