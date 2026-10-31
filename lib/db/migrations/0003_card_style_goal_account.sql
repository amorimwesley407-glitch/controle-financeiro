-- Aparência do cartão e metas ligadas a uma conta. Só adiciona: pode ser aplicada antes do deploy sem afetar a versão no ar.
ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "cardBrand" text;
ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "cardColor" text;
ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "cardLastDigits" text CHECK ("cardLastDigits" ~ '^[0-9]{4}$');
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "accountId" integer REFERENCES "financial_accounts"("id") ON DELETE SET NULL;
