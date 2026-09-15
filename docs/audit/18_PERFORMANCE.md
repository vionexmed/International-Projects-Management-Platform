# 18 — Performance

Análise estática. A aplicação não foi submetida a carga.

## Classificação

### REAL BOTTLENECK

**PERF-001 — `getPortfolioProgress`** (`src/server/services/dashboard.ts`).
Carrega **todos** os projetos da organização e, para cada um, **todas** as etapas
e **todas** as tarefas. Sem `take`, sem filtro de status. Alimenta `/reports` e o
CSV `/api/reports/portfolio`. Com 500 projetos × 80 tarefas são 40 mil linhas por
render.

**PERF-002 — `getThread`** (`src/server/services/messages.ts`). Carrega a
conversa inteira com `sender` e `reads` por mensagem, sem `take` e sem cursor.
Uma conversa longa com um fornecedor recarrega tudo a cada abertura.

**DB-010 — índices de ordenação ausentes.** `listProjects`, `listDocuments` e
`listTasks` paginam corretamente com `skip`/`take`, mas ordenam por `updatedAt`
ou `dueDate` sem índice que sirva o `ORDER BY`. Toda página ordena o conjunto
inteiro do tenant antes de fatiar. Com `skip` crescente, o custo é quadrático.

**Busca sem índice possível.** `contains` + `mode: "insensitive"` vira
`ILIKE '%q%'`, que **nenhum índice B-tree serve**. `search()` dispara 4
sequential scans por tecla digitada no command palette. Não há `pg_trgm`.

### POTENTIAL BOTTLENECK

- **`include` pesados nas guardas de acesso.** `requireDocumentAccess` traz
  **todas** as versões com `uploadedBy` em cada; `requireDocumentRequestAccess`
  traz todas as versões **e** todas as replies. Em toda checagem de acesso.
- **`listInclude`** (`services/projects.ts`) materializa **todas** as tarefas de
  cada projeto da página só para calcular uma porcentagem. Com `perPage: 50` no
  portal, são 50 subconsultas. Deveria ser um `groupBy`.
- **14+ `findMany` sem limite**: `listSuppliers`, `listSupplierOptions`,
  `getSupplierProfile`, `listTeam`, `listInternalUserOptions`, `listThreads`,
  `markThreadRead`, `supplierRecipients`, `getProjectWorkspace` (×3),
  `listProjectCountries`, `listDocumentRequests`.
- **11 colunas de FK sem índice** — Postgres não as indexa sozinho. Todo
  `DELETE`/`UPDATE` do pai vira sequential scan.
- **Pool sem configuração** (`src/server/db.ts`): default de **10 conexões por
  processo**, multiplicado pelas instâncias serverless. Sem `statement_timeout`,
  as consultas ilimitadas acima seguram conexão indefinidamente.
- **Sem streaming de arquivo** — 25 MB inteiros em memória por download.

### NOT A CONCERN YET

- **Zero N+1.** `grep -rn "map(async\|Promise.all(.*map"` em `src/server` e
  `src/app`: **nenhuma ocorrência**. Todos os contadores usam `groupBy` + `Map`.
  O comentário em `listSuppliers` — *"so the page cost does not grow with the
  number of suppliers"* — descreve o que o código de fato faz. **Este é o ponto
  mais forte do código sob a ótica de performance.**
- Fronteira servidor/cliente limpa: 41 client components, todos folhas de
  formulário ou primitivos, nenhum importando Prisma ou `@/server/**`.
- `date-fns` não entra em client component.

## PERF-003 — Cache inexistente, e `revalidatePath` é decorativo · **MEDIUM**

Zero ocorrências de `unstable_cache`, `"use cache"`, `cacheLife`, `cacheTag` ou
`export const revalidate`.

Três camadas já impedem qualquer cache:
1. `src/proxy.ts` gera um nonce CSP por requisição — o próprio comentário assume
   que isso força renderização dinâmica.
2. `next.config.ts` envia `Cache-Control: private, no-store, max-age=0` em toda
   página e rota de API.
3. `cookies()` via `getCurrentUser` opta por dinâmico em qualquer rota autenticada.

Consequência: **as 59 chamadas de `revalidatePath` não invalidam nada.** São
inócuas hoje e viram um contrato mal-entendido amanhã.

A postura conservadora é defensável — `no-store` universal é a escolha certa
quando o risco número um é vazamento entre tenants. Mas deixa o Cache Components
do Next 16 inteiramente na mesa. Três dropdowns (`listSupplierOptions`,
`listInternalUserOptions`, `listProjectCountries`) são não-paginados, chamados em
toda página de lista e **não contêm dado de fornecedor** — poderiam ser cacheados
com `cacheTag` por organização sem tocar no invariante.

A única memoização real é `cache()` do React em `getCurrentUser` — legítima e
importante, já que layout e página chamam `requireUser` em paralelo.

## PERF-004 — 6,4 MB de snapshot em todo build · **MEDIUM**

`"build": "npm run demo:snapshot && next build"` gera
`src/server/demo/snapshot/data.ts` com 6.430.753 bytes de base64 **em todo
build**, inclusive num deploy com `DATABASE_URL` onde
`shouldUseEmbeddedDatabase()` nunca retornará `true`. O import é dinâmico, então
não é avaliado — mas é empacotado e implantado.
