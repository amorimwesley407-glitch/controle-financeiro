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

As migrações em [`lib/db/migrations/0001_init.sql`](lib/db/migrations/0001_init.sql) (aplicadas em ordem e registradas na tabela `schema_migrations`) criam as tabelas, relacionamentos, índices e o bucket privado `finance-uploads`. A aplicação fornece URLs temporárias somente para usuários autenticados. As migrações são idempotentes e podem ser executadas novamente com segurança.

## Desenvolvimento local

Inicie o servidor:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Rodar como serviço em servidor próprio

Para manter o app no ar num servidor seu (acessado por http, por exemplo via Tailscale), sem deixar um terminal aberto:

1. No `.env.local`, adicione `ALLOW_HTTP=true`. Assim o app não força HTTPS, o que deixaria a página sem CSS quando acessada por http. Não defina essa variável na Vercel.
2. Gere o build e instale o serviço de usuário do systemd:

```bash
npm run build
mkdir -p ~/.config/systemd/user
ln -sf "$PWD/deploy/clareza.service" ~/.config/systemd/user/clareza.service
systemctl --user daemon-reload
systemctl --user enable --now clareza
loginctl enable-linger "$USER"   # mantém o serviço rodando sem sessão aberta
```

O app fica em `http://IP-DO-SERVIDOR:3000` e volta sozinho depois de reiniciar a máquina. Para usar `npm run dev` ao mesmo tempo, use outra porta: `npm run dev -- -H 0.0.0.0 -p 3001`.

- Atualizar depois de mudar o código: `npm run build && systemctl --user restart clareza`
- Ver os logs: `journalctl --user -u clareza -f`
- Parar: `systemctl --user stop clareza` (ou `disable --now` para não subir no boot)

## Backup do banco

`deploy/backup-db.sh` copia o banco do `DATABASE_URL` do `.env.local` para `~/backups/clareza/` com `pg_dump`, confere que a cópia abre e guarda só as 7 mais recentes (mude com `BACKUP_DIR` e `BACKUP_KEEP`). O `pg_dump` precisa ser da mesma versão do servidor ou mais nova; para Postgres 17 no Ubuntu, instale pelo repositório oficial:

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-client-17
```

Para rodar todo dia às 03:00:

```bash
ln -sf "$PWD/deploy/clareza-backup.service" "$PWD/deploy/clareza-backup.timer" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now clareza-backup.timer
systemctl --user start clareza-backup   # faz um backup agora para testar
```

- Ver os backups: `ls -lh ~/backups/clareza`
- Ver quando roda e se deu certo: `systemctl --user list-timers clareza-backup` e `journalctl --user -u clareza-backup`
- Restaurar (substitui os dados atuais do banco): `pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" ~/backups/clareza/ARQUIVO.dump`

Os backups ficam no mesmo disco do banco: protegem contra apagar dados por engano, não contra perder o disco. Para isso, copie de vez em quando a pasta para outro lugar.

## Atualização automática

`deploy/update-app.sh` traz o que entrou na `main` do GitHub, instala as dependências se o `package-lock.json` mudou, roda `tsc`, os testes e o build, e só então reinicia o serviço `clareza`. Se algum passo falhar, volta para a versão anterior e o app continua no ar. Não faz nada se a pasta estiver em outra branch ou com mudanças não commitadas.

Para rodar todo dia às 03:30 (depois do backup):

```bash
ln -sf "$PWD/deploy/clareza-update.service" "$PWD/deploy/clareza-update.timer" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now clareza-update.timer
systemctl --user start clareza-update   # atualiza agora para testar
```

- Ver o resultado: `journalctl --user -u clareza-update`
- Próxima execução: `systemctl --user list-timers clareza-update`

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm start` | Executa o build de produção |
| `npm run lint` | Verifica o código com ESLint |
| `npm run db:migrate` | Aplica o schema PostgreSQL e prepara o Storage |
| `npm run db:categorize` | Sugere categorias para lançamentos sem categoria (`-- --apply` grava) |
| `npm test` | Roda os testes (Vitest) |

Os testes de isolamento entre usuários (`app/actions/finance.isolation.test.ts`) só rodam com `TEST_DATABASE_URL` apontando para um banco **descartável**, porque ele é apagado e recriado a cada execução. No CI isso já é configurado. Localmente, por exemplo:

```bash
TEST_DATABASE_URL=postgresql://USUARIO:SENHA@127.0.0.1:5433/controle_financeiro_test npm test
```

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
