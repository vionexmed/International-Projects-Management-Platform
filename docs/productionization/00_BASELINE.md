# Baseline de produtionização

Registrado antes de qualquer alteração, para que "o que mudou" tenha um ponto
de partida verificável.

## Código

| | |
|---|---|
| Commit | `78d1e67` — *feat: freeze Vionex functional product scope* |
| Branch | `main` |
| `git status` | limpo (0 arquivos modificados) |
| Freeze | PRODUCT FUNCTIONAL FREEZE: YES |

## Testes no baseline

253 — 93 unit, 160 integration. 0 failures, 0 skips. Lint, typecheck e build
limpos.

## Migrations

| Ordem | Nome | Conteúdo |
|---|---|---|
| 1 | `20260902195200_init` | schema inicial completo |
| 2 | `20260909155300_login_throttle` | tabela `LoginAttempt` |
| 3 | `20260915111827_review_history_and_attachments` | `DocumentRequestReview`, `MessageAttachment`, FK de `DocumentRequestReply.authorId` |

`prisma/migrations/migration_lock.toml` → provider `postgresql`.

**As três são imutáveis.** Nomes conferidos no repositório.

## Schema

26 tabelas, 23 enums, 48 foreign keys. Sem `@@schema`, sem multiSchema, sem
extensão Postgres exigida (nenhum `citext`, `pgcrypto`, `uuid-ossp`, PostGIS,
GIN/GiST). Ids são `cuid()` gerados na aplicação — o banco não precisa de
geração de UUID.

## Drivers

| | |
|---|---|
| Banco | Prisma **7.10** + `@prisma/adapter-pg` sobre `pg` 8.23 |
| Cliente gerado | `src/generated/prisma` (versionado) |
| Datasource de migration | `prisma.config.ts` → `DIRECT_URL` ?? `DATABASE_URL` |
| Storage | driver próprio: `local` (padrão) ou `s3` (`@aws-sdk/client-s3`) |
| Fallback de desenvolvimento | PGlite embutido quando não há `DATABASE_URL` **e** `APP_ENV` permite demo |

## Auth

Sessão própria: JWT HS256 (`jose`) em cookie `vionex_session` httpOnly, 8h ou
30 dias. Payload só com `sub` e `org` — papel, status e fornecedor são relidos
do banco a cada request. Senha em bcrypt custo 12. Throttle por e-mail e IP.
Sem NextAuth, sem SSO, sem MFA.

## Variáveis de ambiente conhecidas

Declaradas em `src/lib/env-schema.ts`:

`NODE_ENV` · `APP_ENV` · `DATABASE_URL` · `DIRECT_URL` · `AUTH_SECRET` ·
`APP_URL` · `STORAGE_DRIVER` · `STORAGE_LOCAL_DIR` · `STORAGE_ENDPOINT` ·
`STORAGE_REGION` · `STORAGE_ACCESS_KEY` · `STORAGE_SECRET_KEY` ·
`STORAGE_BUCKET` · `STORAGE_FORCE_PATH_STYLE` · `UPLOAD_MAX_SIZE_MB` ·
`EMAIL_SERVER` · `EMAIL_FROM` (declaradas, sem consumidor).

Local: existe `.env` (não versionado) e `.env.example` (versionado, sem
segredo).

## Deploy e CI no baseline

- **Sem** `.github/` — nenhum CI.
- **Sem** `vercel.json` e **sem** `vercel.ts`.
- Vercel CLI não instalado na máquina.
- Nenhum projeto Supabase existe.
- Nenhum ambiente de staging ou produção existe.
- `DATABASE_URL` de produção não existe.

## Banco de desenvolvimento atual

**Classificação: DISPOSABLE DEVELOPMENT DATA.**

Organização única `vionex`, com 9 usuários, 6 projetos, 10 documentos, 11
versões, 4 solicitações, 5 mensagens, 6 notificações. Todos os 5 usuários
internos são `@vionex.com` do seed de demonstração, criados em 15/09/2026, e
**nenhum** tem `lastLoginAt`. Projetos são "Product Zeta" e similares.

Nada aqui é informação real da Vionex. **Não há dado a migrar.**

Nota honesta: a conta real `lucas.sapuppo@vionex.med.br`, criada durante PC-5,
foi removida quando rodei `npm run seed` na PC-6B — o seed trunca as tabelas
antes de recriar a demonstração. Recriar é um comando
(`npm run user:create`), mas o apagamento foi efeito colateral de uma ação
minha e está registrado aqui em vez de ficar implícito.
