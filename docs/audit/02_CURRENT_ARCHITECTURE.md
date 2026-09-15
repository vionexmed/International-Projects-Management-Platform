# 02 — Arquitetura atual

## Classificação geral: **ACEITÁVEL**, com um ponto que **PRECISA EVOLUIR**

A arquitetura é coerente e o isolamento entre fornecedores está expresso num
lugar só. O que precisa evoluir é a disciplina de camadas: 11 páginas consultam
o banco diretamente, sem passar pelo serviço.

## Fluxo real

```
Browser
  │
  ├─ src/proxy.ts ....................... só define CSP com nonce. NÃO autoriza nada.
  │
  ├─ Layout do grupo de rotas
  │    (internal)/layout.tsx ............ requireInternalUser()  → redirect /supplier
  │    (supplier)/supplier/layout.tsx ... requireSupplierUser()  → redirect /dashboard
  │         │
  │         └─ getCurrentUser()  [src/server/auth/current-user.ts]
  │              ├─ lê cookie vionex_session
  │              ├─ jwtVerify (HS256, issuer fixo)
  │              └─ RELÊ o usuário no banco: role, status, supplierId
  │                 (o cookie carrega apenas id + organizationId)
  │
  ├─ Página RSC
  │    ├─ orNotFound(requireXAccess(user, id))   [src/server/authz/access.ts]
  │    │     └─ findFirst({ AND: [ xScope(user), { id } ] })   ← o escopo faz parte da busca
  │    └─ serviço  [src/server/services/*.ts]
  │
  └─ Server action ("use server")
       ├─ requirePermission("x:y")   → ForbiddenError
       ├─ parseForm(zodSchema, formData)
       └─ serviço → Prisma → PostgreSQL
                         └─ storage()  [S3 ou filesystem]
```

## O núcleo de isolamento

Três arquivos concentram toda a regra de quem vê o quê:

| Arquivo | Papel |
|---|---|
| `src/server/authz/scopes.ts` | 8 funções puras que traduzem a sessão em um `WhereInput` do Prisma. Para uma sessão de fornecedor, **toda** função fixa `supplierId` — direto ou pela relação com o projeto. |
| `src/server/authz/access.ts` | 7 guardas para acesso por identificador. Cada uma refaz o escopo dentro do `findFirst`, então um id fora do escopo é indistinguível de um id inexistente. |
| `src/server/authz/permissions.ts` | Matriz papel × capacidade, pura e testável. |

Esse desenho é o ponto mais forte do sistema. A escolha de compor o escopo
*dentro* da consulta — em vez de buscar e depois comparar — elimina a classe
inteira de bugs em que alguém esquece o `if`.

`src/server/authz/rsc.ts` resolve um detalhe real do App Router: layout e página
renderizam em paralelo, então tratar o erro só no layout deixa a página irmã
rejeitar primeiro e transformar um 404 em tela de erro 200. `orNotFound()`
padroniza o desfecho.

## O que precisa evoluir

### ARCH-001 — 11 páginas consultam o banco diretamente

```
src/app/(internal)/layout.tsx
src/app/(internal)/regulatory/page.tsx
src/app/(internal)/settings/page.tsx
src/app/(internal)/tasks/[taskId]/page.tsx
src/app/(internal)/projects/[projectId]/clinical/page.tsx
src/app/(internal)/projects/[projectId]/go-to-market/page.tsx
src/app/(internal)/projects/[projectId]/import/page.tsx
src/app/(internal)/projects/[projectId]/regulatory/page.tsx
src/app/(supplier)/supplier/layout.tsx
src/app/(supplier)/supplier/(home)/page.tsx
src/app/(supplier)/supplier/projects/(index)/page.tsx
```

**Verificação feita:** as duas páginas do portal do fornecedor aplicam o escopo
corretamente — `documentRequestScope(user)` em `(supplier)/supplier/(home)/page.tsx`
e `project: projectScope(user)` em `(supplier)/supplier/projects/(index)/page.tsx`.
As páginas internas de projeto chamam `requireProjectAccess()` **antes** e depois
filtram por `projectId`, o que é correto por construção.

**Portanto isto não é um furo hoje.** É dívida: não existe nada que impeça a
próxima consulta escrita numa página de esquecer o escopo, e o compilador não
ajuda. Severidade MEDIUM, categoria arquitetura.

### ARCH-002 — Serviços lançam `Error` genérico em vez dos erros tipados

`src/server/services/documents.ts`, função `uploadDocument`, lança
`throw new Error("Projeto não encontrado.")` em vez de `NotFoundError`. Como
`toActionError` (`src/server/actions/utils.ts`) devolve ao usuário qualquer
`Error` com mensagem abaixo de 200 caracteres, isso funciona por acidente — e é
justamente por isso que erros internos inesperados também vazam. Ver SEC-008.

## Acoplamento e duplicação

- Nenhuma dependência circular encontrada.
- `getProjectWorkspace` (`src/server/services/projects.ts`) é compartilhado entre
  o ambiente interno e o portal do fornecedor. Boa reutilização, **mas** é
  exatamente aí que nasce o vazamento de campos internos descrito em TEN-002.
- Os diálogos em `src/features/**` repetem o padrão formulário + `useActionState`
  sem uma abstração comum. Duplicação aceitável, não é dívida urgente.

## Abstrações ausentes

| O que falta | Consequência |
|---|---|
| Camada de repositório ou lint rule proibindo `db.` fora de `src/server/` | ARCH-001 pode virar furo |
| DTO de saída por audiência (interno vs fornecedor) | TEN-002 |
| Camada de notificação (e-mail/push) | GLB-006 |
| Abstração de fuso horário | GLB-002 |
