# 05 — Auditoria de banco de dados

Fonte: `prisma/schema.prisma` (717 linhas) e `prisma/migrations/**`, lidos
integralmente. Nenhum comando de banco foi executado.

## Inventário

| Item | Quantidade |
|---|---|
| Models | 23 |
| Enums | 22 |
| Foreign keys | 42 |
| `@@index` | 33 |
| `@@unique` compostos | 5 |
| `@unique` de campo | 4 |

Chaves primárias: todas `String @id @default(cuid())` — geradas na aplicação, não
no banco. cuid v1 não é ordenável no tempo; irrelevante no volume atual.

## Integridade referencial

### DB-001 — `DocumentRequestReply.authorId` não tem foreign key · **HIGH**

**Verificado duas vezes** (schema e SQL da migration):

```prisma
model DocumentRequestReply {
  id        String   @id @default(cuid())
  requestId String
  authorId  String          // ← sem @relation
  body      String
  createdAt DateTime @default(now())

  request DocumentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  @@index([requestId])
}
```

A migration `20260902195200_init/migration.sql` adiciona **uma única** constraint
a essa tabela: `DocumentRequestReply_requestId_fkey`. Não há
`DocumentRequestReply_authorId_fkey`.

Consequências:
- `src/server/services/documents.ts` → `submitDocumentRequest` grava
  `authorId: user.id` sem nenhuma garantia de que o usuário exista.
- Não é possível fazer `include: { author: ... }` — e de fato
  `requireDocumentRequestAccess` inclui `replies` sem autor, e a página
  `src/app/(supplier)/supplier/action-required/[requestId]/page.tsx` renderiza as
  respostas **sem nome de quem escreveu**. A assimetria já aparece no produto.
- É a única tabela de conteúdo do sistema cuja autoria não é rastreável por join.
  Num contexto de dispositivos médicos, isso enfraquece a cadeia de custódia da
  resposta do fornecedor.

### DB-002 — `AuditLog` é apagado em cascata com a organização · **HIGH**

`AuditLog_organizationId_fkey ... ON DELETE CASCADE`. Um registro de auditoria
que desaparece junto com o objeto auditado não serve como prova. Para um sistema
que registra `document.download` e mudanças de permissão, isso anula o propósito.

### DB-003 — Política de autoria incoerente entre tabelas · **HIGH**

O mesmo conceito — "quem escreveu isto" — tem três tratamentos diferentes:

| Relação | `onDelete` | Efeito ao apagar o usuário |
|---|---|---|
| `Task.createdById` | **Restrict** | impede a exclusão |
| `Document.createdById` | **Restrict** | impede |
| `DocumentVersion.uploadedById` | **Restrict** | impede |
| `DocumentRequest.requestedById` | **Restrict** | impede |
| `TaskComment.authorId` | **Cascade** | **apaga os comentários** |
| `Message.senderId` | **Cascade** | **apaga as mensagens** |
| `DocumentRequestReply.authorId` | *sem FK* | deixa órfã |

Pior ainda, a cadeia `Supplier → User → TaskComment/Message` é toda Cascade:
**apagar um fornecedor apaga comentários e mensagens que são metade de conversas
do lado da Vionex.** O histórico do lado interno some junto.

**Mitigação factual e importante:** a aplicação **nunca apaga nada**. As únicas
chamadas de exclusão em todo `src/` são `loginAttempt.deleteMany`
(`src/server/auth/throttle.ts`) e a remoção do cookie. Não existe
`project.delete`, `supplier.delete`, `user.delete` nem `document.delete`.

Isso rebaixa a probabilidade, não o impacto. O cenário real é a limpeza manual
via Prisma Studio ou SQL — exatamente onde essas cascatas disparam.

### DB-004 — Não existe caminho de exclusão de usuário · **MEDIUM**

Seis FKs `Restrict` garantem que qualquer usuário que já criou uma tarefa, enviou
um documento ou abriu uma solicitação **nunca** poderá ser excluído. Só existe
`UserStatus.SUSPENDED`.

Para LGPD/GDPR (direito ao esquecimento) isso é uma limitação estrutural que
precisa de decisão explícita: anonimização no lugar versus exclusão real. Ver
[12_DATA_GOVERNANCE.md](12_DATA_GOVERNANCE.md).

### DB-005 — Unicidade ausente onde a lógica assume · **MEDIUM**

| Onde | Evidência | Efeito |
|---|---|---|
| `MessageThread` sem `@@unique([projectId, withSupplier])` | `src/server/services/messages.ts` → `ensureProjectThread` faz `findFirst` → `create` fora de transação | duas threads "compartilhadas" no mesmo projeto; conversa partida para o fornecedor |
| `Milestone` sem `@@unique([projectId, position])` | `src/server/actions/stages.ts` → `createMilestoneAction` faz `count` → `create({ position: count })` fora de transação | posições duplicadas, ordenação não-determinística |
| `User.email` é único **globalmente**, não por organização | `email String @unique` | a mesma pessoa não pode existir em duas organizações; latente enquanto houver uma só |

Do lado positivo, `@@unique([documentId, version])` **existe** — verificado na
linha 481 do schema — então a corrida de numeração de versão é barrada pelo
banco. Ver DB-010 para o que sobra.

## Tenancy no nível do banco

Apenas **6 das 23 tabelas** carregam `organizationId`: `Supplier`, `User`,
`Project`, `Task`, `Document`, `AuditLog`.

As outras 16 dependem inteiramente de um join até `Project` ou `User`:
`ProjectStage`, `Milestone`, `TaskComment`, `DocumentVersion`,
**`DocumentRequest`**, `DocumentRequestReply`, `ClinicalStudy`, `RegulatoryItem`,
`ImportShipment`, `GtmItem`, `MessageThread`, `Message`, `MessageRead`,
`TimelineEvent`, `Notification`, `LoginAttempt`.

(`LoginAttempt` é global de propósito e está correto — é anterior a qualquer sessão.)

### DB-006 — `DocumentRequest` não carrega `organizationId` · **HIGH**

**Verificado:** o model tem `supplierId` e `projectId`, e nenhum `organizationId`.

O cabeçalho do próprio `schema.prisma` afirma que todo registro com escopo de
tenant carrega `organizationId`. **Isso é falso para `DocumentRequest`.**

Em `src/server/authz/scopes.ts`, `documentRequestScope` amarra o tenant apenas
pelo join: `{ project: { organizationId: user.organizationId } }`. Não há um
único predicado sobre a própria tabela.

Somado ao índice `DocumentRequest(supplierId, status)`, que convida a uma
consulta filtrada só por `supplierId`, isso é uma armadilha para o próximo
desenvolvedor. Com mais de uma organização e um fornecedor compartilhado, vaza.

Além disso, **adicionar `organizationId` às 16 tabelas é pré-requisito de
qualquer plano futuro de RLS** — sem essa coluna, cada policy precisaria de
subconsulta até `Project`.

## Migrations

| Ordem | Diretório | Conteúdo |
|---|---|---|
| 1 | `20260902195200_init` | 22 `CREATE TYPE`, 22 `CREATE TABLE`, 40 índices, 42 FKs |
| 2 | `20260909155300_login_throttle` | `LoginAttempt` + 2 índices |

`migration_lock.toml` versionado, provider `postgresql`.

**Higiene: boa.** Nenhuma migration editada à mão. Nenhum `db push`. Contagens do
schema batem exatamente com o SQL (33 `@@index` = 31+2 `CREATE INDEX`;
9 únicos = 5 compostos + 4 de campo; 42 `onDelete` = 42 FKs). **Sem drift.**

Ver [06_SQL_AND_MIGRATIONS.md](06_SQL_AND_MIGRATIONS.md) para os problemas de
processo — que são sérios.

## Índices

### Faltando — cada um amarrado a uma consulta real

| Índice | Consulta que o exige |
|---|---|
| `Project(organizationId, updatedAt DESC)` | `src/server/services/projects.ts` → `listProjects` (`orderBy updatedAt desc` + `skip`/`take`) e `search.ts` → `search` |
| `Document(organizationId, updatedAt DESC)` | `src/server/services/documents.ts` → `listDocuments` |
| `Task(organizationId, status, dueDate)` | `tasks.ts` → `listTasks` e `countTasksByStatus`; `dashboard.ts` → `listUpcomingDeadlines`. O `Task_dueDate_idx` atual é **cego ao tenant** — varre prazos de todas as organizações antes de filtrar |
| `MessageThread(projectId, updatedAt DESC)` | `messages.ts` → `listThreads` |
| `pg_trgm` + GIN em `Project.name`, `Project.projectCode`, `Task.title`, `Document.name`, `Supplier.name` | os 5 serviços que usam `contains` + `mode: "insensitive"`, que o Prisma traduz para `ILIKE '%q%'` — **nenhum índice B-tree serve isso**. `search()` dispara 4 sequential scans por tecla digitada no command palette |
| Índices nas 11 colunas de FK sem índice | Postgres não indexa a coluna filha automaticamente. `Message.senderId`, `TaskComment.authorId`, `Document.createdById`, `DocumentVersion.uploadedById`, `Task.createdById`, `DocumentRequest.{documentId,taskId,requestedById}`, `TimelineEvent.actorId`, `AuditLog.actorId`, `DocumentRequestReply.authorId` |

Os índices existentes servem os **filtros**; não servem as **ordenações**. Toda
página paginada ordena o conjunto inteiro do tenant antes de fatiar.

### Redundantes

| Índice | Por quê |
|---|---|
| `ProjectStage_projectId_idx` | o `UNIQUE(projectId, key)` já cobre o prefixo |
| `DocumentVersion_documentId_idx` | o `UNIQUE(documentId, version)` já cobre |
| `Document_supplierId_visibility_idx` | **morto**: nenhuma consulta filtra por `Document.supplierId` — `documentScope` escopa deliberadamente pela relação com o projeto |

## O que está bem feito

| Ponto | Evidência |
|---|---|
| **Zero injeção de SQL** | As únicas construções raw são ``db.$queryRaw`SELECT 1` `` (tagged template) e um `$executeRawUnsafe` com string literal estática (`TRUNCATE`), guardado por `NODE_ENV !== production`. Nenhuma interpolação de variável em SQL em todo o repositório. |
| **Zero N+1** | `grep -rn "map(async\|Promise.all(.*map"` em `src/server` e `src/app`: **nenhuma ocorrência**. Todos os contadores usam `groupBy` + `Map`. |
| Singleton do Prisma com `globalThis` | `src/server/db.ts` — evita esgotar o pool no HMR |
| Instanciação preguiçosa via `Proxy` | permite `next build` sem `DATABASE_URL`; métodos religados com `.bind()` para preservar o receiver de `$transaction` |
| Separação `DATABASE_URL` / `DIRECT_URL` | `prisma.config.ts` prefere `DIRECT_URL` para migrations — correto, porque advisory locks de sessão não existem num pooler em modo transação |
| Sem drift entre schema e migrations | contagens conferidas item a item |
