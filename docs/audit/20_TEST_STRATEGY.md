# 20 — Estratégia de testes

## Inventário real

| Arquivo | Testes | Cobre |
|---|---:|---|
| `tests/unit/scopes.test.ts` | 6 | **O núcleo do isolamento.** Verifica recursivamente que todo escopo de fornecedor fixa `supplierId` e **nunca menciona outro** — prova ausência, não só presença. Roda sem banco |
| `tests/unit/permissions.test.ts` | 6 | matriz papel × capacidade, os 8 papéis |
| `tests/unit/env.test.ts` | 15 | `envSchema`, incluindo que os diagnósticos expõem nomes e nunca valores |
| `tests/unit/project-health.test.ts` | 20 | lógica pura de progresso e derivação de status |
| `tests/unit/demo-mode.test.ts` | 5 | **fixa como intencional** que `isDemoEnabled()` retorna `true` inclusive em produção |
| `tests/unit/route-structure.test.ts` | 3 | invariante de framework: `loading.tsx` nunca em segmento com filho dinâmico |
| `tests/integration/auth.test.ts` | 8 | bcrypt, round-trip do JWT, token adulterado, e que **o papel não viaja no token** |
| `tests/integration/throttle.test.ts` | 8 | throttle por e-mail e por IP |
| `tests/integration/supplier-isolation.test.ts` | 14 | **a prova do invariante central**, pelos dois lados |
| `tests/integration/workflows.test.ts` | 12 | criação de projeto, ciclo completo de solicitação, versionamento, download |

96 testes, de qualidade acima da média.

## TEST-001 — A suíte falha em aberto · **HIGH** · bloqueia produção

Executado nesta auditoria, com o Postgres local parado:

```
 Test Files  4 failed | 6 passed (10)
      Tests  9 failed | 61 passed | 26 skipped (96)
```

Os **26 pulados são exatamente `supplier-isolation` (14) + `workflows` (12)** —
o `beforeAll` explodiu e o Vitest pulou o corpo inteiro. **A suíte que prova o
isolamento entre fornecedores não executou uma única asserção**, e o runner
encerrou imprimindo "61 passed".

> **Correção de uma afirmação anterior minha nesta sessão.** Mais cedo eu
> relatei "96 testes passando" após rodar `npm test`. Aquilo estava correto
> naquele momento — o Postgres local estava de pé. O que eu não verifiquei é o
> que acontece quando não está. Agora está verificado, e é o oposto do que um
> resultado verde deveria significar.

**Causa:** `tests/setup.ts` verifica a **existência** de `DATABASE_URL`, não a
alcançabilidade do servidor. O `.env` tem a variável apontando para
`localhost:5433`, então o guard passa e o banco não responde.

**Por que importa:** é o cenário mais provável — alguém esquece
`npm run db:start`. E como o CI não está instalado (GOV-001), **não existe
nenhum lugar onde a suíte de isolamento rode de fato hoje**.

## Cobertura versus risco

| Risco | Testado? |
|---|---|
| Isolamento entre fornecedores | **Sim, e bem — mas só no CI, que não está ligado** |
| Matriz de autorização | Sim |
| Guardas de acesso direto | Sim, as 6 principais. `requireDocumentVersionAccess` só indiretamente |
| Sessão / JWT | Sim |
| **Cookie (flags `httpOnly`/`sameSite`/`secure`)** | **Não** |
| **Schemas Zod das server actions** | **Não** — só `envSchema` |
| **Server actions** | **Não** — zero testes importam de `src/server/actions/**`. `toActionError`, funil único de erro de 11 actions, não tem um teste |
| **Componentes React** | **Não, zero** — `environment: "node"`, sem testing-library |
| **E2E** | **Não existe** |
| **Fuso horário, locale, i18n** | **Não** — nenhum teste menciona `timeZone`, `daysUntil` ou `formatDate` |
| Cobertura medida | Não |

## O caminho não testado mais perigoso

**`src/app/demo/enter/route.ts`.** Não só não tem teste de segurança como tem um
teste que **afirma o comportamento inseguro como desejado**. Toda a engenharia de
`scopes.ts` e `access.ts` é irrelevante para quem abre `/demo/enter?as=klaus`.

Segundo: `toActionError` — por onde passam todos os erros de todas as actions.

## Um vazamento introduzido amanhã seria pego?

**No CI, para os casos cobertos, sim.** Pegaria: remover `supplierId` de um
escopo, trocar `findFirst` escopado por `findUnique` numa guarda, expor
`INTERNAL_ONLY` a um fornecedor, vazar o diretório de fornecedores na busca.

**Não pegaria:** uma guarda **nova**; vazamento via server action que não passe
pelos serviços testados; vazamento via `/api/reports/[report]` (nenhum teste toca
essa rota); vazamento na camada de componente; **e o vazamento TEN-002, que já
existe hoje e passou despercebido**.

**Localmente, não pegaria nada** — porque a suíte pula sem reclamar.

## Estratégia proposta, por risco

| Prioridade | O que | Por quê |
|---|---|---|
| **P0** | Fazer a suíte **falhar** quando o banco está inalcançável | um teste que não roda é pior que nenhum teste: dá falsa confiança |
| **P0** | Instalar o CI | é o único lugar onde a suíte roda inteira |
| **P0** | Inverter `demo-mode.test.ts` | hoje é um obstáculo à correção do bloqueador nº 1 |
| **P1** | Teste que serialize o payload RSC da página de projeto com sessão de fornecedor e **falhe** se `notes`/`blockerNote` aparecerem | pegaria TEN-002 e toda a classe |
| **P1** | Testes de `toActionError` | funil único de erro |
| **P1** | Teste HTTP de `/api/files/[versionId]` e `/api/reports/[report]` com sessão de outro fornecedor | hoje só indireto |
| **P2** | Matriz de fuso horário — ver [36_GLOBAL_TEST_MATRIX.md](36_GLOBAL_TEST_MATRIX.md) | GLB-002 |
| **P2** | E2E dos dois caminhos críticos: login interno → projeto → documento; login fornecedor → solicitação → upload → submissão | nenhum teste hoje exercita a UI |
| **P3** | Cobertura medida com threshold | |
