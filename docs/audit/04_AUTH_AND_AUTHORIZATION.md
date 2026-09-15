# 04 — Autenticação e autorização

## Autenticação

### Fluxo real de login

`src/server/actions/auth.ts`, função `signIn`:

1. Zod valida e normaliza o e-mail (`trim().toLowerCase().email()`).
2. `checkLoginThrottle(email, ip)` — consulta `LoginAttempt` no banco.
3. `db.user.findUnique({ where: { email } })`.
4. `verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)` — o hash dummy
   tem o mesmo custo, então o tempo de resposta não revela se a conta existe.
5. Recusa se `status !== "ACTIVE"`.
6. Recusa conta de fornecedor sem `supplierId` (não haveria como escopar).
7. `clearLoginThrottle`, emite o token, grava `lastLoginAt`, registra
   `auth.login` no audit log.
8. Redireciona conforme o papel.

A ordem está correta: throttle antes da consulta, verificação de senha sempre
executada, resposta idêntica para "não existe" e "senha errada".

### Sessão

| Propriedade | Valor | Avaliação |
|---|---|---|
| Formato | JWT HS256 (`jose`) | adequado |
| Conteúdo | apenas `sub` (user id) e `org` | **acerto** — papel e `supplierId` são relidos do banco a cada requisição |
| Emissor | `vionex-projects`, verificado | ok |
| Cookie | `httpOnly`, `SameSite=lax`, `Secure` em produção, `path=/` | ok |
| Duração padrão | 8 horas | ok |
| "Lembrar de mim" | **30 dias** | longo demais para uma plataforma de documentos |
| Revogação | **inexistente** | SEC-007 |
| Rotação | **inexistente** | o token não é renovado nem rotacionado |
| MFA | **inexistente** | SEC-007 |

### Cobertura de checklist

| Item | Situação |
|---|---|
| Login | implementado |
| Cadastro público | não existe (correto para B2B) |
| Reset de senha | **não existe** — hoje um usuário que esquece a senha depende de um ADMIN. Gap funcional e operacional. |
| OAuth / magic link | não existe |
| Brute force | throttle por e-mail (8/10min) ✓ e por IP (20/10min) — o de IP é contornável (SEC-005) |
| Enumeração de usuários | mitigada pelo `DUMMY_HASH` |
| Session fixation | não se aplica — token novo a cada login |
| Reuso de sessão | possível: token válido sobrevive à troca de senha (SEC-007) |
| Política de senha | **nenhuma** — nenhum mínimo de comprimento ou complexidade na criação |
| Bloqueio de conta | não — apenas atraso por janela |
| Alerta de login suspeito | não |

## Autorização

Dois eixos independentes, e é importante não confundi-los:

- **Capacidade** — *o que* este papel pode fazer. `src/server/authz/permissions.ts`.
- **Escopo** — *sobre quais linhas*. `src/server/authz/scopes.ts`.

Uma ação de escrita precisa dos dois. As server actions chamam
`requirePermission()` e os serviços aplicam o escopo.

### Matriz PAPEL × RECURSO × AÇÃO

Derivada de `ROLE_PERMISSIONS` em `src/server/authz/permissions.ts`.

R = read · C = create · U = update · A = archive · Up = upload · Rq = request ·
Rv = review · M = manage · S = send

| Recurso | ADMIN | MANAGER | REGULATORY | IMPORT | MARKETING | VIEWER | SUPPLIER_ADMIN | SUPPLIER_USER |
|---|---|---|---|---|---|---|---|---|
| Projects | R C U A | R C U A | R C U | R U | R U | R | R¹ | R¹ |
| Tasks | R C U | R C U | R C U | R C U | R C U | R | R¹ | R¹ |
| Documents | R Up Rq Rv | R Up Rq Rv | R Up Rq Rv | R Up Rq Rv | R Up Rq Rv | R | R¹ Up¹ | R¹ Up¹ |
| Suppliers | R M | R M | R | R | R | R | — | — |
| Users | M | — | — | — | — | — | M² | — |
| Reports | R | R | R | R | R | R | — | — |
| Messages | S | S | S | S | S | — | S¹ | S¹ |
| Settings | M | — | — | — | — | — | — | — |
| Etapa Clinical | M | M | M | — | — | — | — | — |
| Etapa Regulatory | M | M | M | — | — | — | — | — |
| Etapa Import | M | M | — | M | — | — | — | — |
| Etapa Go-to-Market | M | M | — | — | M | — | — | — |

¹ Restrito ao próprio fornecedor pelo escopo — ver [07_RLS_AND_MULTITENANCY.md](07_RLS_AND_MULTITENANCY.md).
² `portal:manage-users` só existe na matriz; ver AUTH-002.

### Observações sobre a matriz

**AUTH-001 · MEDIUM — `document:read` é tudo ou nada.**
`VIEWER` recebe `document:read` e pode baixar qualquer documento da organização,
inclusive `visibility: INTERNAL_ONLY` — contratos, NDAs, material regulatório. Não
há noção de sensibilidade por documento, só "interno" versus "compartilhado com o
fornecedor". Para um papel chamado "Visualizador" isso é mais amplo do que o nome
sugere. Evidência: `INTERNAL_READ` em `src/server/authz/permissions.ts`;
`documentScope` em `scopes.ts` não filtra por `visibility` para papéis internos.

**AUTH-002 · LOW — `portal:manage-users` não tem implementação.**
`SUPPLIER_ADMIN` tem a capacidade, mas `grep -rn "portal:manage-users" src/`
retorna apenas a definição. Não existe tela de gestão de usuários no portal.
Capacidade declarada e não exercida: ou a funcionalidade falta, ou a capacidade
deveria sair.

**AUTH-003 · LOW — `IMPORT` e `MARKETING` podem atualizar qualquer projeto.**
Ambos herdam `PROJECT_CONTRIBUTOR`, que inclui `project:update`. O papel sugere
escopo por etapa, mas a permissão é global sobre o projeto. Não há autorização
por etapa nem por participação no projeto — qualquer usuário interno alcança
qualquer projeto da organização. Isso pode ser intencional numa equipe pequena;
precisa de decisão de negócio, registrada em [38_UNRESOLVED_QUESTIONS.md](38_UNRESOLVED_QUESTIONS.md).

## IDOR / BOLA

Testado por leitura em cada rota com identificador na URL.

| Rota | Guarda | Resultado se o id não pertence ao chamador |
|---|---|---|
| `/projects/[projectId]` e sub-rotas | `requireProjectAccess` | 404 |
| `/tasks/[taskId]` | `requireTaskAccess` | 404 |
| `/suppliers/[supplierId]` | `requireSupplierAccess` | 404 |
| `/supplier/projects/[projectId]` e sub-rotas | `requireProjectAccess` | 404 |
| `/supplier/action-required/[requestId]` | `requireDocumentRequestAccess` | 404 |
| `GET /api/files/[versionId]` | `requireDocumentVersionAccess` | 404 |
| `GET /api/reports/[report]` | allowlist `REPORTS` | 404 |

Cada guarda em `src/server/authz/access.ts` compõe o escopo **dentro** do
`findFirst`:

```ts
const project = await db.project.findFirst({
  where: { AND: [projectScope(user), { id: projectId }] },
  ...
});
if (!project) throw new NotFoundError("Projeto não encontrado.");
```

Consequência: um id fora do escopo é indistinguível de um id inexistente. Não há
canal lateral para descobrir que o registro existe. **Esse é o padrão correto e
está aplicado de forma consistente.**

`orNotFound()` (`src/server/authz/rsc.ts`) garante que o resultado seja um 404 de
verdade e não uma tela de erro com status 200 — detalhe que importa porque layout
e página renderizam em paralelo no App Router.

**Conclusão sobre IDOR: nenhum encontrado.** Status CONFIRMED por leitura das 7
guardas e de todas as rotas parametrizadas.
