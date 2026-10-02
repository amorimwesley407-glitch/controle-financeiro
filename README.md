# Clareza — Controle Financeiro

Aplicação de controle financeiro pessoal com Next.js, React, TypeScript, Drizzle ORM e Better Auth. Organiza receitas, despesas, categorias, orçamentos, metas e investimentos, com gráficos, importação de lançamentos e imagens privadas.

## Rodar localmente

Pré-requisitos: Node.js 22 ou superior, npm e Docker com Docker Compose. O Docker precisa estar iniciado.

Na pasta do projeto:

```bash
npm ci
npm run local:setup
npm run local:db
npm run db:migrate
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e crie uma conta. A senha deve ter pelo menos 12 caracteres.

O comando `local:setup` cria `.env.local` com um segredo aleatório de autenticação. Se o arquivo já existir, ele é preservado: ajuste suas variáveis conforme `.env.example`. O comando `local:db` inicia o PostgreSQL e espera o banco ficar pronto antes de retornar. A migração é idempotente.

O banco e os uploads rodam na própria máquina, sem necessidade de conta no Supabase ou na Vercel. A instalação inicial precisa de internet para baixar as dependências e a imagem Docker. Cotações e histórico de investimentos continuam consultando serviços externos; quando indisponíveis, o painel mantém suas funções financeiras e trata a ausência de cotações. As fontes usam as disponíveis no sistema, sem download no build.

## Configuração local

O arquivo `.env.local` criado pelo setup contém:

```env
BETTER_AUTH_SECRET=<segredo gerado automaticamente>
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://clareza:clareza_local@127.0.0.1:5433/controle_financeiro
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=.local/uploads
SUPABASE_STORAGE_BUCKET=finance-uploads
BRAPI_TOKEN=
```

`BRAPI_TOKEN` é opcional para ampliar a lista de cotações. As variáveis do Supabase podem ficar vazias no modo local. Nunca envie `.env.local` ao Git.

O PostgreSQL é publicado somente em `127.0.0.1:5433`, para evitar conflito com um banco existente na porta 5432. Caso a porta 5433 esteja ocupada, altere o mapeamento em `compose.yaml` e a porta de `DATABASE_URL`.

Se usar outra porta para o Next.js, ajuste também `BETTER_AUTH_URL` para a URL exata aberta no navegador.

Para acessar por IP ou executar desenvolvimento e produção em portas diferentes, adicione as URLs exatas em `.env.local` e reinicie os servidores:

```env
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3001,http://172.22.11.31:3000,http://172.22.11.31:3001
```

Substitua o IP pelo endereço da sua máquina. Essa lista também libera os arquivos de desenvolvimento do Next.js para os mesmos hosts.

## Dados e imagens

- O banco persiste no volume Docker `controle-financeiro-local_postgres-data`.
- As novas imagens ficam em `.local/uploads`, fora da pasta pública e ignoradas pelo Git.
- A rota `/api/uploads/…` valida a sessão e o dono do arquivo a cada leitura, sem cache público.
- Os uploads aceitam PNG, JPEG, WebP e AVIF até 2 MB, com validação do formato.

Para parar o banco sem apagar os dados:

```bash
npm run local:stop
```

Nas próximas execuções, basta iniciar o banco e o servidor:

```bash
npm run local:db
npm run dev
```

Para backup, preserve tanto o volume do PostgreSQL quanto a pasta `.local/uploads`. O ambiente local inicia com um banco independente; contas, lançamentos e imagens existentes no Supabase não são importados automaticamente.

## Build de produção local

Com o banco iniciado e `.env.local` configurado:

```bash
npm run build
npm start
```

Abra a mesma URL `http://localhost:3000`. Analytics só é ativado na Vercel. A PWA está disponível no build de produção em localhost ou HTTPS; o service worker guarda apenas arquivos estáticos e a página offline, sem dados financeiros, sessões ou imagens privadas.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run local:setup` | Cria o ambiente local e o segredo de autenticação |
| `npm run local:db` | Inicia o PostgreSQL local e espera sua disponibilidade |
| `npm run local:stop` | Para o banco preservando os dados |
| `npm run db:migrate` | Aplica o schema PostgreSQL |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm start` | Executa o build de produção |
| `npm test` | Executa os testes |
| `npm run lint` | Verifica o código com ESLint |

Validação:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Supabase e Vercel (opcionais)

A integração remota continua disponível. Para usá-la, configure `DATABASE_URL` do Supabase, `STORAGE_PROVIDER=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` e `BETTER_AUTH_URL` com o domínio público HTTPS. Execute `npm run db:migrate` no ambiente escolhido. Veja [SUPABASE_VERCEL.md](SUPABASE_VERCEL.md).

Armazenamento em disco precisa de uma máquina com disco persistente; para Vercel, selecione o provedor Supabase. Mudar de provedor não copia arquivos existentes.

## Solução de problemas

- **Docker indisponível:** inicie o Docker Desktop ou o serviço Docker e confira as permissões do usuário.
- **Banco não conecta:** execute `npm run local:db` e confira `DATABASE_URL`, especialmente a porta 5433.
- **Invalid origin:** faça `BETTER_AUTH_URL` corresponder exatamente à URL do navegador e reinicie a aplicação.
- **Imagens não aparecem:** confira `STORAGE_PROVIDER=local`, a pasta `LOCAL_STORAGE_DIR` e a sessão autenticada.

## Estrutura

```text
app/                       Páginas, ações financeiras e APIs
app/api/uploads/           Leitura autenticada de imagens locais
components/                Dashboard e componentes visuais
lib/db/                    Schema e migração PostgreSQL
lib/local-storage.ts       Armazenamento privado em disco
lib/storage.ts             Upload, URLs e remoção por usuário
scripts/                   Setup e migrações
compose.yaml               PostgreSQL local persistente
```

Projeto privado para uso pessoal.
