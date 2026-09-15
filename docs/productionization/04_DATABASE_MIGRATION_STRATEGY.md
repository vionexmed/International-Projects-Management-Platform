# Estratégia de banco e migrations

## Duas conexões, dois propósitos

| Variável | Quem usa | Qual conexão do Supabase |
|---|---|---|
| `DATABASE_URL` | a aplicação, em runtime | **Transaction pooler** — porta `6543` |
| `DIRECT_URL` | `prisma migrate`, `db:proof`, scripts | **Session pooler** — porta `5432` no host `pooler` (ou o host direto, se houver IPv6) |

Por quê: `prisma migrate` adquire um advisory lock de sessão para impedir que
duas migrations rodem ao mesmo tempo. Um pooler em modo transação devolve a
conexão a cada statement, então o lock não sobrevive — a migration falha ou,
pior, duas rodam juntas.

`prisma.config.ts` já resolve `DIRECT_URL ?? DATABASE_URL`, então definir
apenas `DATABASE_URL` funciona onde não há pooler (CI, banco local) e as duas
variáveis são necessárias no Supabase.

### Prepared statements

O adapter `pg` não usa prepared statements nomeados por padrão, que é o
incompatível com pooling em modo transação. Não é preciso `?pgbouncer=true`
com driver adapter — esse parâmetro é da engine Rust, que não está em uso.

## Migrations são forward-only

As três existentes são **imutáveis**:

```
20260902195200_init
20260909155300_login_throttle
20260915111827_review_history_and_attachments
```

Proibido, em qualquer ambiente persistente: editar migration antiga, fazer
squash, `prisma db push`, `prisma migrate reset`, `DROP SCHEMA`.

Banco novo recebe a história inteira com:

```bash
DIRECT_URL="<session pooler>" npx prisma migrate deploy
```

## Prova do banco zerado

`npm run db:proof` — versionado em `scripts/migration-proof.mjs`, roda no CI.

Cria um banco descartável, aplica todas as migrations com `migrate deploy`, e
verifica:

- as 3 migrations terminaram e nenhuma foi revertida;
- as 25 tabelas essenciais existem;
- os 9 enums essenciais existem;
- há 40+ foreign keys (as `Restrict` são o que mantém o histórico
  atribuível — um banco com as tabelas e sem elas passaria numa checagem rasa
  e perderia isso);
- `prisma migrate diff --from-migrations --to-schema` não acusa diferença.

**Resultado da execução desta rodada:**

```
3 migrations · 26 tabelas · 23 enums · 48 foreign keys · sem diferença para schema.prisma
```

Os bancos descartáveis (o alvo e o shadow) são removidos ao final, inclusive
em caso de falha.

Isso existe porque o banco de desenvolvimento foi migrado aos poucos, um
`migrate dev` por vez, ao longo de semanas — o que não diz nada sobre o
*histórico* funcionar do zero. A primeira vez que alguém descobriria seria ao
criar o primeiro ambiente novo, que é o pior momento possível.

## Dados atuais

**DISPOSABLE DEVELOPMENT DATA** — ver `00_BASELINE.md`. Nada a migrar. O banco
Supabase nasce vazio e recebe apenas as migrations e um administrador real.

Se algum dia houver dado real a mover, isso exige plano próprio: cópia,
verificação, contagem antes e depois, e só então corte.

## Ordem de aplicação no Supabase

1. Criar o projeto (nada é aplicado automaticamente).
2. `DIRECT_URL` apontando para o **session pooler**.
3. `npx prisma migrate deploy` → aplica as 3 na ordem.
4. Conferir em `_prisma_migrations`: 3 linhas, todas com `finished_at`,
   nenhuma com `rolled_back_at`.
5. `GET /api/ready` → `migrations: 3 applied`.
6. **Nenhum seed de demonstração.** Só `npm run create-admin`.
