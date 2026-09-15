# 06 — SQL e migrations

## Higiene das migrations: **boa**

| Ordem | Diretório | Conteúdo |
|---|---|---|
| 1 | `20260902195200_init` | 22 `CREATE TYPE`, 22 `CREATE TABLE`, 40 índices, 42 FKs |
| 2 | `20260909155300_login_throttle` | `LoginAttempt` + 2 índices |

`migration_lock.toml` versionado. Nenhuma migration editada à mão. Nenhum
`db push` em lugar nenhum. **Sem drift** — as contagens do `schema.prisma` batem
exatamente com o SQL.

## Caminho paralelo de schema (não é drift)

`scripts/generate-schema-sql.mjs` lê as migrations em ordem e concatena num
literal em `src/server/demo/schema-sql.ts`, consumido apenas por
`scripts/build-demo-snapshot.mjs` em tempo de build.

**Verificado: está em dia** — contém as duas migrations.

**Mas a regeneração é manual** (`npm run schema:sql`). Nada no `build`, no CI ou
num hook garante que uma migration nova seja refletida. A falha seria silenciosa:
a demonstração simplesmente subiria com schema velho.

## GOV-002 — Nenhum passo de deploy aplica migrations · **HIGH**

`package.json` → `"build": "npm run demo:snapshot && next build"`. Não há
`vercel.json`, nem `vercel-build`, nem `postbuild`. O `README.md` instrui
`npm run db:deploy` à mão.

Deploy e schema estão desacoplados: é possível promover código que espera uma
coluna que o banco não tem, e nada detecta.

O contraste é gritante — `ci/github-ci.yml` **faz** `prisma migrate deploy`
contra um Postgres real. O pipeline certo existe e não está ligado (GOV-001).

## Sem rollback, sem convenção expand/contract

Não há migration inversa para nenhuma das duas, nem convenção documentada. Para
as migrations da Fase E — que convertem tipos de data — isso precisa existir
**antes**, não depois.

## Regras propostas

1. **Forward-only.** Migration aplicada é imutável: não editar, não mover, não
   renomear, não reaplicar. Correção é sempre uma migration nova.
2. **Expand → migrate → contract** para toda mudança de tipo ou remoção de coluna.
3. Toda migration com efeito destrutivo exige backup verificado na mesma janela e
   aprovação explícita.
4. `prisma migrate deploy` no pipeline, antes de o novo código receber tráfego.
5. `npm run schema:sql` encadeado ou verificado no CI.

## Segurança de SQL: **limpa**

**Zero injeção.** As únicas construções raw em todo o repositório:

- ``db.$queryRaw`SELECT 1` `` em `src/app/api/health/route.ts` — tagged template,
  sem interpolação.
- `$executeRawUnsafe` em `prisma/seed.ts` → `reset()` — argumento é uma **string
  literal estática** (`TRUNCATE … CASCADE`), e a chamada é guardada em `main()`
  por `NODE_ENV === "production" && ALLOW_DESTRUCTIVE_SEED !== "1"`.

Nenhuma interpolação de variável em SQL em nenhum lugar.
