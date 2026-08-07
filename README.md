# Clareza — Controle Financeiro

Aplicação web de controle financeiro pessoal construída com Next.js. Permite organizar receitas e despesas, acompanhar orçamentos, metas e investimentos, importar lançamentos e armazenar comprovantes e imagens no Supabase.

## Funcionalidades

- Cadastro e autenticação com e-mail e senha
- Receitas, despesas e lançamentos recorrentes
- Categorias personalizadas com ícones e imagens
- Orçamentos mensais por categoria
- Metas financeiras
- Carteira de investimentos
- Importação de transações por planilha
- Cotações e histórico de ativos brasileiros
- Tema claro e escuro
- Upload de fotos, comprovantes e imagens para o Supabase Storage
- Dashboard responsivo com gráficos e indicadores
- Instalação como PWA no celular ou computador, com página offline segura

## Tecnologias

- [Next.js 16](https://nextjs.org/) com App Router e Server Actions
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Supabase](https://supabase.com/) para PostgreSQL e Storage
- [Better Auth](https://www.better-auth.com/) para autenticação
- [Recharts](https://recharts.org/) para gráficos
- [Vercel](https://vercel.com/) para hospedagem

## Pré-requisitos

- Node.js 20 ou superior
- npm
- Um projeto no Supabase

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/amorimwesley407-glitch/controle-financeiro.git
cd controle-financeiro
npm install
```

Crie o arquivo `.env.local` usando `.env.example` como referência:

```env
BETTER_AUTH_SECRET=gere-um-segredo-com-pelo-menos-32-caracteres
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres.PROJECT_REF:SENHA@HOST-DO-POOLER:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=finance-uploads
BRAPI_TOKEN=
```

> Nunca envie `.env.local` ao Git. `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` e `BETTER_AUTH_SECRET` são segredos de servidor.

Se a senha do banco contiver caracteres especiais, codifique-os na URL. Por exemplo, `!` deve ser escrito como `%21`.

## Configuração do Supabase

1. No painel do Supabase, abra **Connect → ORM → Drizzle**.
2. Copie a URL do **Transaction Pooler**, na porta `6543`, para `DATABASE_URL`.
3. Em **Settings → API Keys**, crie ou copie uma Secret Key para `SUPABASE_SERVICE_ROLE_KEY`.
4. Configure a Project URL em `NEXT_PUBLIC_SUPABASE_URL`.
5. Execute a migração:

```bash
npm run db:migrate
```

A migração em [`lib/db/migration.sql`](lib/db/migration.sql) cria as tabelas, relacionamentos, índices e o bucket privado `finance-uploads`. A aplicação fornece URLs temporárias somente para usuários autenticados. A migração é idempotente e pode ser executada novamente com segurança.

## Desenvolvimento local

Inicie o servidor:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm start` | Executa o build de produção |
| `npm run lint` | Verifica o código com ESLint |
| `npm run db:migrate` | Aplica o schema PostgreSQL e prepara o Storage |

Para uma validação completa antes de publicar:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Deploy na Vercel

1. Importe este repositório na Vercel.
2. Em **Project Settings → Environment Variables**, cadastre todas as variáveis de `.env.example`.
3. Aplique os segredos aos ambientes necessários, preferencialmente separando produção e preview.
4. Em produção, defina a URL pública exata:

```env
BETTER_AUTH_URL=https://seu-dominio.vercel.app
```

5. Faça o deploy ou um redeploy depois de alterar variáveis.

O Better Auth também reconhece automaticamente as URLs fornecidas pela Vercel para produção, previews e branches. Mesmo assim, `BETTER_AUTH_URL` deve apontar para o domínio definitivo usado pelos usuários.

## Instalação como aplicativo (PWA)

Depois do deploy HTTPS, navegadores compatíveis exibem o botão **Instalar Clareza**. Também é possível usar o menu do Chrome/Edge ou, no iPhone e iPad, **Compartilhar → Adicionar à Tela de Início**.

O service worker armazena apenas o shell offline e arquivos estáticos versionados. Páginas autenticadas, respostas de API, sessões, dados financeiros e imagens privadas não são gravados no cache offline.

## Estrutura principal

```text
app/
  actions/finance.ts       Ações financeiras executadas no servidor
  api/auth/                Rotas do Better Auth
  api/stocks/              Consulta de histórico de ativos
  sign-in/ e sign-up/      Telas de autenticação
components/                Dashboard e componentes visuais
lib/
  auth.ts                  Configuração de autenticação
  db/                      Cliente, schema e migração PostgreSQL
  storage.ts               Upload e remoção no Supabase Storage
scripts/                   Scripts de banco e migração de dados
```

## Segurança

- O banco é acessado somente pelo servidor através de `DATABASE_URL`.
- A chave secreta do Supabase nunca deve receber o prefixo `NEXT_PUBLIC_`.
- As tabelas possuem RLS habilitado sem políticas públicas; a aplicação usa a conexão PostgreSQL do servidor.
- O Storage aceita apenas PNG, JPEG, WebP e AVIF, com limite de 2 MB por imagem.
- Cada consulta financeira valida o usuário autenticado antes de ler ou alterar dados.

## Solução de problemas

### `Invalid origin`

Confirme que `BETTER_AUTH_URL` corresponde exatamente ao domínio aberto no navegador, sem barra no final, e faça um redeploy.

### `password authentication failed`

Confira a senha do banco, o usuário `postgres.PROJECT_REF` e a URL do Transaction Pooler. Garanta também que exista apenas uma linha `DATABASE_URL` no arquivo de ambiente.

### Imagens não aparecem

Verifique `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, o nome do bucket e se o bucket privado `finance-uploads` existe.

## Licença

Projeto privado para uso pessoal.
