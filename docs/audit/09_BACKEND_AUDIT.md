# 09 — Auditoria de backend

## Classificação: **ACEITÁVEL**

O fluxo pretendido existe e é seguido na maior parte:

```
Server Action ("use server")
  → requirePermission("x:y")        capacidade
  → parseForm(zodSchema, formData)  validação
  → serviço                         regra de negócio + escopo
  → Prisma                          dados
```

Nenhum arquivo passa de 500 linhas. Nenhum god service. Nenhuma dependência
circular. Para 18 mil linhas, a navegação é fácil.

## ARCH-001 — 11 páginas consultam o banco direto · **MEDIUM**

Listadas em [02_CURRENT_ARCHITECTURE.md](02_CURRENT_ARCHITECTURE.md).

**Verificado uma a uma:** todas aplicam o escopo. As do portal usam
`documentRequestScope(user)` e `project: projectScope(user)`; as internas chamam
`requireProjectAccess()` **antes** e depois filtram por `projectId`.

**Não é um furo hoje.** É dívida: nada impede a próxima consulta de esquecer, e
o compilador não ajuda. Sem RLS embaixo (DB-008), não há segunda linha.

Mitigação barata: uma regra de ESLint proibindo importar `@/server/db` fora de
`src/server/`.

## ARCH-002 — Serviços lançam `Error` genérico · **MEDIUM**

`src/server/services/documents.ts` → `uploadDocument` lança
`throw new Error("Projeto não encontrado.")` em vez de `NotFoundError`.

Funciona por acidente: `toActionError` devolve qualquer `Error` curto. É
exatamente esse acidente que causa SEC-008.

## Consistência das server actions

Shape único e bem desenhado (`src/server/actions/utils.ts`):

```ts
export type ActionState = {
  ok?: boolean; error?: string;
  fieldErrors?: Record<string, string[]>; createdId?: string;
};
```

Todas as actions de formulário retornam erro tipado e **nunca lançam**.
`src/components/app/form-dialog.tsx` consome esse shape de forma uniforme.

Três exceções deliberadas: `signIn` tem shape próprio e termina em `redirect()`;
`signOut` e as de notificação retornam `void`; `markThreadReadAction` engole tudo.

**OPS-004 — duas ações falham em silêncio total:** `markThreadReadAction` loga e
retorna `void`; `setLanguageAction` faz `if (!parsed.success) return;` sem
nenhum feedback — o usuário clica para trocar de idioma, nada acontece, nada
explica.

## Guardas por nome em vez de `instanceof` — e uma inconsistência

`src/server/authz/errors.ts` usa `error.name` de propósito, e a razão está escrita
no arquivo: os grafos RSC e SSR são separados e `instanceof` fica silenciosamente
falso. Como a distinção decide entre 404 e 403, é a decisão certa.

Aplicada consistentemente em `rsc.ts`, `toActionError` e na rota de arquivos. E a
detecção de erro do Prisma no mesmo arquivo **usa** a abordagem por nome.

**Mas** `toActionError` usa `error instanceof z.ZodError`. Zod tem exatamente o
mesmo risco de duplicação entre grafos. Falha aqui degrada a experiência (perda
dos `fieldErrors` por campo), não a segurança — mas contraria a política que o
próprio repositório documenta.

**Código morto:** `AuthenticationError` e `isAuthenticationError` não são usados
em lugar nenhum.

## Serviços

12 serviços em `src/server/services/`, todos recebendo `SessionUser` e compondo o
escopo. O maior tem 443 linhas.

Padrão de agregação exemplar: `listSuppliers` resolve três contadores com três
`groupBy` paralelos e junção em `Map`, *"so the page cost does not grow with the
number of suppliers"*. Replicado em `listTeam`, `listSupplierBottlenecks`,
`countTasksByStatus`, `listThreads`.

Cinco serviços **não reaplicam o escopo**, dependendo de o id já vir filtrado —
`getSupplierProfile` (4 consultas com `{ supplierId }` cru),
`listSupplierBottlenecks` (2), `listTeam` (2). Não é explorável hoje, mas é
defesa em profundidade ausente, e sem RLS não há rede.

## Validação

Zod em toda server action, com `parseForm` normalizando `FormData` (strings
vazias viram `undefined`, arquivos vazios viram `undefined`). Bom.

Mas **nenhum schema de action é testado** — só `envSchema`. E as mensagens estão
todas em português, inclusive nas que o fornecedor recebe (GLB-013).
