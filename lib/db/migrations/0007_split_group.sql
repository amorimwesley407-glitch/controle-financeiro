-- Liga as partes de um lançamento dividido entre categorias. Nulo é um lançamento comum.
-- Só adiciona: pode ser aplicada antes do deploy sem afetar a versão no ar.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "splitGroup" text;
CREATE INDEX IF NOT EXISTS "transactions_split_group_idx" ON "transactions" ("splitGroup");
