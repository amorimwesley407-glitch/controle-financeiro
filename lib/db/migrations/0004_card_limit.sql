-- Limite do cartão de crédito, opcional. Só adiciona: pode ser aplicada antes do deploy sem afetar a versão no ar.
ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "creditLimitCents" integer CHECK ("creditLimitCents" > 0);
