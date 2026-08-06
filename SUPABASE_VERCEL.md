# Supabase + Vercel

## 1. Criar o banco e o bucket

No painel do Supabase, abra **SQL Editor**, cole o conteúdo de `lib/db/migration.sql` e execute uma vez.
O script é idempotente: cria as tabelas, índices e o bucket privado `finance-uploads`.

## 2. Configurar o ambiente local

Copie as variáveis de `.env.example` para `.env.local` e preencha:

- `DATABASE_URL`: URL do **Transaction Pooler** do Supabase (porta 6543). Use `?sslmode=require` se a URL gerada não o incluir.
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL em **Settings > API**.
- `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role`/secret em **Settings > API**. Ela é somente do servidor.
- `BETTER_AUTH_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `BETTER_AUTH_URL`: `http://localhost:3000` localmente.

Depois execute `npm run db:migrate` e `npm run dev`.

## 3. Configurar a Vercel

Em **Project Settings > Environment Variables**, adicione as mesmas variáveis para Production e Preview. Em produção, defina:

```text
BETTER_AUTH_URL=https://seu-projeto.vercel.app
SUPABASE_STORAGE_BUCKET=finance-uploads
```

Não exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador e não a prefixe com `NEXT_PUBLIC_`.

## Dados do SQLite antigo

A alteração não apaga os arquivos `controle-financeiro.db`; eles continuam como backup local. O esquema é criado no Supabase, mas os registros antigos não são copiados automaticamente. Faça essa importação separadamente antes de desativar o banco local, caso queira preservar os dados existentes.
