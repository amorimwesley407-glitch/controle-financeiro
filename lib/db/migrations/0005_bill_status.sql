-- Contas a pagar: status de uma despesa que precisa ser paga até a data dela. Nulo é um lançamento comum.
-- Só adiciona: pode ser aplicada antes do deploy sem afetar a versão no ar.
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "billStatus" text CHECK ("billStatus" IN ('pending', 'paid'));
