# 17 — Observabilidade

## Nota: 2/10

## As perguntas que a operação precisa responder

| Pergunta | Consegue responder hoje? |
|---|---|
| A aplicação está no ar? | Parcialmente — `/api/health`, se alguém consultar |
| Qual endpoint está falhando? | **Não** |
| Qual versão causou o problema? | **Não** |
| Qual query está lenta? | **Não** |
| Qual usuário foi afetado? | **Não** |
| Qual job falhou? | não há jobs |
| Alguém baixou aquele contrato? | os dados existem em `AuditLog`, **mas não há tela, filtro nem export** |

## OPS-001 — Nenhum mecanismo de observabilidade · **HIGH** · bloqueia produção

Verificado em `package.json` e em todo `src/`:

- **Logging framework:** nenhum (sem `pino`, `winston`, `consola`)
- **Error monitoring:** nenhum (sem Sentry, Bugsnag, Rollbar)
- **Métricas:** nenhuma
- **Tracing:** nenhum (sem OpenTelemetry, sem `instrumentation.ts`)
- **RUM / APM:** nenhum

O único mecanismo é `console.error` para stdout. Em produção serverless isso vira
o log do provedor, sem nível, sem correlação de requisição, sem agregação e **sem
alerta**. Um 500 em produção é indistinguível de silêncio.

Consequência concreta: os dois sinais mais críticos do sistema —
`"[audit] failed to record entry"` (perda de trilha regulatória) e
`"[throttle] check failed, allowing attempt"` (throttle de login em falha
aberta) — são linhas de stdout que ninguém lê.

O `error.digest` exibido em quatro error boundaries **não tem contraparte em
lugar nenhum**. O usuário lê "Referência: 3f2a…" e não existe onde essa
referência signifique alguma coisa.

## O que está limpo

**Zero `console.log`, `console.warn` ou `console.debug` em `src/`.** Nenhum
resto de depuração num repositório de 18 mil linhas. As 13 ocorrências são todas
`console.error` operacionais, com prefixo `[escopo]` consistente.

Os 24 `console.log` em `scripts/` e `prisma/` são feedback de CLI, intencionais.

## Risco de segredo em log

Li os 13 pontos. **Nada loga senha, hash, token de sessão, valor de cookie ou
conteúdo de documento.** Verificações específicas:

- `src/server/actions/auth.ts` (`signIn`): **nenhum** `console.*`. Nem e-mail, nem senha. Correto.
- `src/server/auth/session.ts`: nenhum log; `verifySessionToken` usa `catch {}` mudo — o token nunca é impresso.

Três riscos de segundo grau:

1. **`src/server/db.ts`** configura `log: ["error"]` em todos os ambientes. O que
   o Prisma 7 imprime sob `prisma:error` inclui a invocação e o trecho de código
   ao redor — observado literalmente na saída do `npm test`, que despejou o corpo
   de `createTestOrg`. Num erro de `findUnique({ where: { email } })` durante o
   login, o e-mail (dado pessoal) pode acompanhar o `meta`. **PARCIALMENTE CONFIRMADO.**
2. **`console.error("[health] database unreachable", error)`** — um
   `PrismaClientInitializationError` carrega host e porta. A senha é redigida
   pelo Prisma, o endpoint não.
3. **`console.error("[action] unexpected error", error)`** — um erro de
   `uploadDocument` carrega `storageKey` (`organizationId/projectId/uuid-nome`) e
   o nome do arquivo do fornecedor. Metadado, não conteúdo.

## `/api/health`

Três estados distintos (`misconfigured` 503 / `degraded` 503 / `ok` 200), com
import preguiçoso de `env` e `db` — porque importá-los é exatamente o que falha
quando a configuração está errada. É um endpoint pensado por quem já operou algo.

**Mas não é suficiente para saber que a aplicação está saudável:**

| Não cobre | Consequência |
|---|---|
| **Storage** | com `STORAGE_DRIVER=s3` e credenciais erradas, responde `ok` enquanto **todo upload e download falha**. `storage()` só valida na primeira chamada |
| **Estado das migrations** | um deploy com schema defasado responde `ok`; as queries quebram uma a uma |
| **Pool de conexões** | `SELECT 1` passa igual por um pool saudável e por um exaurido |
| **`isDemoEnabled()`** | a condição **mais perigosa** do deploy não aparece nos `warnings`, embora chave publicada e storage efêmero apareçam |
| **Liveness × readiness** | um endpoint só — **a separação foi decidida e está desenhada em A1**, ver [26](26_MASTER_IMPLEMENTATION_PLAN.md) |

E o comentário do cabeçalho diz que a resposta `ok` *"carries no detail at all"*,
mas ela traz `database`, `storage`, `warnings`, `latencyMs` e `timestamp` — **sem
autenticação**. Os `warnings` contam a um anônimo que as sessões são assinadas
com chave publicada.

## Mínimo proposto

> **Atualização (revisão 2 do plano):** a divisão liveness/readiness e a correção
> do vazamento de `warnings` a anônimos foram movidas para **A1**. O que resta
> aqui pertence à **Fase J**.

1. Error monitoring com alerta, capturando o `digest`, para que a referência
   mostrada ao usuário signifique algo. **A1 já cria `src/instrumentation.ts`**,
   que exporta `onRequestError` — o gancho exato para isto, conforme
   `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`.
2. Log estruturado em JSON com `requestId`, `userId`, `organizationId` — **nunca** `supplierId` de terceiros, nunca conteúdo.
3. Alerta específico em `"[audit] failed to record entry"` e em `"[throttle] check failed"`.
4. `/api/health` cobrindo storage e estado das migrations, e reportando `isDemoEnabled()`.
5. Separar liveness de readiness.
6. Log de query lenta no Prisma.
