# 07 — Isolamento entre fornecedores (multitenancy)

> Esta é a garantia mais importante da plataforma: **o Fornecedor A nunca pode
> ver dado do Fornecedor B.** Este documento verifica se isso é verdade.

## Veredito

**O isolamento horizontal — fornecedor contra fornecedor — está correto.**
Verificado por leitura das 8 funções de escopo, das 7 guardas de acesso e de
todas as rotas parametrizadas. Não encontrei nenhum caminho em que um fornecedor
alcance a linha de outro.

**O isolamento vertical — Vionex contra fornecedor — tem um furo.** Campos de uso
interno da Vionex chegam ao navegador do fornecedor. Ver TEN-002.

## Row Level Security no banco: **não existe**

`grep -riE "ROW LEVEL SECURITY|CREATE POLICY|ALTER TABLE.*ENABLE RLS"` sobre todo
o repositório não retorna nada. Não há Supabase RLS, não há policies, não há
GRANTs por papel. A aplicação conecta com um único usuário de banco que tem
acesso total.

**Isso não é, por si, um defeito** — o isolamento está na camada de aplicação e
está bem feito. Mas significa que **não há segunda linha de defesa**: uma única
consulta escrita sem escopo, em qualquer lugar, vaza dados imediatamente. É por
isso que ARCH-001 (11 páginas consultando o banco direto) importa mais do que
pareceria.

Registrado como decisão consciente a revisar, não como correção urgente.

## TENANT ISOLATION MATRIX

Cenário de teste conceitual: **Fornecedor China A** tentando alcançar dado do
**Fornecedor Germany B**.

Fonte: `src/server/authz/scopes.ts`.

| Recurso | Como o escopo é fixado para uma sessão de fornecedor | A tentativa resulta em |
|---|---|---|
| Projects | `supplierId` direto + `organizationId` + `archivedAt: null` | 404 |
| Tasks | `supplierId` **e** `project.supplierId` (dupla âncora) | 404 |
| Documents | `project.supplierId` **e** `visibility: SHARED_WITH_SUPPLIER` | 404 |
| DocumentRequests | `supplierId` **e** `project.supplierId` | 404 |
| MessageThreads | `project.supplierId` **e** `withSupplier: true` | 404 |
| Messages | herdadas da thread | 404 |
| Suppliers | `id: supplierIdOf(user)` — só a própria empresa | 404 |
| Users | `supplierId` — só usuários da própria empresa | lista vazia |
| TimelineEvents | `project.supplierId` **e** `internal: false` | 404 |
| Notifications | por `userId` | — |
| Downloads (`/api/files`) | `document: documentScope(user)` | 404 |
| Uploads | projeto revalidado com `supplierId` antes de gravar | erro |
| Server actions | `requirePermission` + escopo no serviço | ForbiddenError / 404 |
| Storage (chave do objeto) | `organizationId/projectId/uuid-nome`, nunca exposta ao cliente | — |
| CSV / relatórios | fornecedor barrado antes de qualquer consulta | 403 |

### Por que funciona

Três decisões, todas em `scopes.ts`:

**1. Falha fechada em vez de aberta.** `supplierIdOf()` lança exceção se a sessão
não tiver `supplierId`, em vez de devolver `undefined` — que o Prisma
interpretaria como "sem filtro" e retornaria tudo.

```ts
function supplierIdOf(user: SessionUser): string {
  if (!user.supplierId) {
    throw new Error("Supplier account is not linked to a supplier record.");
  }
  return user.supplierId;
}
```

**2. Âncora dupla nos recursos críticos.** `taskScope` fixa `supplierId` **e**
`project.supplierId`. Se um dia uma `Task.supplierId` for gravada errada, a
relação com o projeto ainda segura. `documentScope` vai além e escopa
*exclusivamente* pela relação, ignorando `Document.supplierId` de propósito — o
comentário no código explica: *"Scoped through the project relation so a mis-set
Document.supplierId can never widen visibility"*. Isso é defesa em profundidade
de verdade.

**3. Três camadas independentes barram uma sessão de fornecedor inválida.**
- `src/server/actions/auth.ts` recusa o login (`isSupplierRole && !supplierId`);
- `src/server/auth/current-user.ts` recusa a sessão na leitura do cookie;
- `supplierIdOf()` lança se ainda assim chegar até a consulta.

## TEN-002 — Campos internos da Vionex visíveis ao fornecedor · **HIGH**

**Evidência:** `src/server/services/projects.ts`, função `getProjectWorkspace`:

```ts
export async function getProjectWorkspace(user: SessionUser, projectId: string) {
  const project = await requireProjectAccess(user, projectId);
  const [stages, tasks, milestones] = await Promise.all([
    db.projectStage.findMany({ where: { projectId }, orderBy: { position: "asc" } }),
    ...
    db.milestone.findMany({ where: { projectId }, ... }),
  ]);
```

Essa função é chamada **pelos dois ambientes**:
- `src/app/(internal)/projects/[projectId]/page.tsx`
- `src/app/(supplier)/supplier/projects/[projectId]/page.tsx` (linha que faz
  `await orNotFound(getProjectWorkspace(user, projectId))`)

`requireProjectAccess` acerta o controle de acesso — o fornecedor só alcança o
próprio projeto. O problema é o que vem **dentro** do objeto retornado.

As consultas de `projectStage` e `milestone` não têm `select`. Retornam a linha
inteira. E os modelos em `prisma/schema.prisma` contêm:

| Modelo | Campo | Natureza |
|---|---|---|
| `ProjectStage` | `notes String?` | texto livre onde a equipe interna anota o andamento da etapa |
| `Project` | `blockerNote String?` | motivo do bloqueio, redigido pela Vionex |
| `Project` | `description String?` | descrição interna do projeto |
| `Milestone` | `description String?` | detalhe do marco |

Nenhum desses campos tem flag `internal`, ao contrário de `TimelineEvent.internal`
e `Document.visibility` — o modelo **reconhece** a separação interno/externo para
timeline e documentos, e **não a aplica** a etapas, marcos e ao próprio projeto.

Como são componentes de servidor, tudo isso é serializado no payload RSC e fica
legível no DevTools do navegador do fornecedor, **mesmo que a interface não
renderize o campo**. Ocultar no frontend não é autorização — e aqui nem há
ocultação deliberada, apenas ausência de renderização.

**Pior caso realista:** um gestor escreve em `ProjectStage.notes` algo como
*"fornecedor não responde há três semanas, avaliar substituição"* ou
*"margem negociada abaixo do praticado com o Fornecedor B"*. O fornecedor lê.
Não é vazamento entre fornecedores — é vazamento de avaliação comercial interna
para a parte avaliada.

**Status:** CONFIRMED por leitura do serviço, dos dois chamadores e dos três
modelos.

## TEN-003 — Isolamento não é coberto por teste automatizado · **HIGH**

O arquivo `ci/github-ci.yml` descreve exatamente a intenção certa:

> *"The integration suite talks to a real PostgreSQL, because the supplier
> isolation guarantees are expressed as database queries — mocking them would
> test the mock instead of the rules."*

Mas esse arquivo **não está em `.github/workflows/`** — não roda (ver GOV-001).
E a cobertura real dos testes está em [20_TEST_STRATEGY.md](20_TEST_STRATEGY.md).

O isolamento hoje depende de 8 funções corretas e da disciplina de sempre
chamá-las. Sem RLS embaixo e sem teste em cima, uma regressão passa despercebida.

## Isolamento entre organizações

Todo escopo fixa também `organizationId`, e o JWT carrega `org`, que
`getCurrentUser` cruza com o `id` do usuário na consulta. O sistema está pronto
para múltiplas organizações Vionex, embora hoje exista uma só.

Detalhe correto: o cookie sozinho não basta — `findFirst({ id, organizationId })`
exige que os dois batam.
