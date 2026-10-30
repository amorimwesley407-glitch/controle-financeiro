-- Contas, cartões, transferências e parcelas. Só adiciona: pode ser aplicada antes do deploy sem afetar a versão no ar.
CREATE TABLE IF NOT EXISTS "financial_accounts" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('checking', 'savings', 'cash', 'credit_card')),
  "initialBalanceCents" integer NOT NULL DEFAULT 0,
  "closingDay" integer CHECK ("closingDay" BETWEEN 1 AND 31),
  "dueDay" integer CHECK ("dueDay" BETWEEN 1 AND 31),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("kind" <> 'credit_card' OR ("closingDay" IS NOT NULL AND "dueDay" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "financial_accounts_user_name_idx" ON "financial_accounts" ("userId", "name");

CREATE TABLE IF NOT EXISTS "transfers" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "fromAccountId" integer NOT NULL REFERENCES "financial_accounts"("id") ON DELETE CASCADE,
  "toAccountId" integer NOT NULL REFERENCES "financial_accounts"("id") ON DELETE CASCADE,
  "amountCents" integer NOT NULL CHECK ("amountCents" > 0),
  "date" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("fromAccountId" <> "toAccountId")
);
CREATE INDEX IF NOT EXISTS "transfers_user_date_idx" ON "transfers" ("userId", "date");

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "accountId" integer REFERENCES "financial_accounts"("id") ON DELETE SET NULL;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "installmentGroup" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "installmentNumber" integer;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "installmentTotal" integer;
CREATE INDEX IF NOT EXISTS "transactions_account_idx" ON "transactions" ("accountId");
CREATE INDEX IF NOT EXISTS "transactions_installment_group_idx" ON "transactions" ("installmentGroup");
