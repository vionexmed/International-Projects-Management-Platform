# 24 — Candidatos a limpeza

> **Identificação apenas. Nada foi removido.**

## O andaime de demonstração — a parte que importa

| Artefato | Natureza | Alcançável em produção? |
|---|---|---|
| `src/lib/demo.ts` | andaime — `isDemoEnabled()` é `return true` literal | **SIM, sempre** |
| `src/app/demo/page.tsx` | andaime — seletor com 8 usuários nomeados | **SIM** |
| `src/app/demo/enter/route.ts` | andaime — emite sessão real sem senha | **SIM** |
| `src/app/page.tsx` | produção, mas ramifica para o andaime | **a raiz leva anônimos ao seletor** |
| `src/components/app/demo-banner.tsx` | andaime visível | só se `isPublicDemo()` |
| `src/server/demo/embedded-db.ts` | andaime — PGlite em memória | só sem `DATABASE_URL` |
| `src/server/demo/{seed-data,projects,stages,helpers}.ts` | andaime (dataset fictício) | não em runtime |
| `src/server/demo/snapshot/data.ts` (6,4 MB) | gerado, gitignorado | **empacotado em todo build** |
| `scripts/build-demo-snapshot.mjs` | andaime de build | **roda em todo `npm run build`** |
| `tests/unit/demo-mode.test.ts` | teste que **trava o andaime no lugar** | — |

**Veredito: o andaime não é isolável por configuração.** Não há variável, flag de
build ou `NODE_ENV` que o desligue — `isDemoEnabled()` é uma função constante.

Para ser justo: é uma **decisão consciente e documentada**. `src/lib/demo.ts` diz
com todas as letras que a função precisa retornar `false` antes de dados reais; o
banner aparece; `robots.ts` bloqueia indexação. O trabalho de sinalização foi
feito.

O problema é o modo de falha: a transição depende de **alguém lembrar de editar
uma função**, e nada força, detecta ou alerta esse momento. O `/api/health` não
reporta. E o único teste sobre o assunto afirma que está tudo certo.

**Classificação: KEEP, com trava.** Não remover — mas `isDemoEnabled()` precisa
passar a depender do ambiente antes de qualquer dado real (Fase A).

## Tabela geral

| Item | Caminho | Classificação | Razão |
|---|---|---|---|
| `AuthenticationError` + `isAuthenticationError` | `src/server/authz/errors.ts` | **SAFE TO REMOVE** | zero call sites; falta de sessão é tratada por `redirect` e por 401 explícito |
| `listMyOpenTasks` | `src/server/services/dashboard.ts` | **SAFE TO REMOVE** | exportada, nenhum importador |
| `formatDateShort` | `src/lib/format.ts` | **SAFE TO REMOVE** | nenhum importador |
| `CountBadge` | `src/components/ui/badge.tsx` | **SAFE TO REMOVE** | nenhum uso — e o contador é reimplementado inline em 4 lugares |
| `Button variant="danger"` | `src/components/ui/button.tsx` | **SAFE TO REMOVE** | zero ocorrências de `variant="danger"` |
| prop `breadcrumb` do `Topbar` | `src/components/app/topbar.tsx` | **SAFE TO REMOVE** | nunca é passada |
| `<option value="ZH">中文</option>` | `src/features/suppliers/add-supplier-user-dialog.tsx` | **SAFE TO REMOVE** | `SELECTABLE_LOCALES` exclui `zh` e o commit `54c3191` foi "tirar o chinês". Permite criar usuário num idioma que a UI não oferece |
| `tsconfig.tsbuildinfo` (331 KB) | raiz | **SAFE TO REMOVE** | já coberto por `*.tsbuildinfo` no `.gitignore` |
| `ci/README.md` — "os 85 testes" | `ci/README.md` | **SAFE TO REMOVE (corrigir)** | são 96 |
| `DrawerContent` | `src/components/ui/dialog.tsx` | **NEEDS VERIFICATION** | sem uso, mas o nav mobile foi mexido recentemente — pode ser resto de abordagem descartada |
| `isTaskOverdue` | `src/lib/status.ts` | **NEEDS VERIFICATION** | sem importador, mas há um teste que menciona "agrees with isOverdue" |
| `STAGE_TASK_CATEGORY` | `src/server/services/project-health.ts` | **NEEDS VERIFICATION** | pode ser usada indiretamente na derivação |
| 5 server actions sem consumidor | ver [38](38_UNRESOLVED_QUESTIONS.md) | **NEEDS VERIFICATION** | são **funcionalidades não ligadas**, não lixo |
| `project.archive` em `AuditAction` | `src/server/services/audit.ts` | **NEEDS VERIFICATION** | declarado e nunca emitido; `Project.archivedAt` existe e nada o escreve |
| 8 pacotes Radix instalados e nunca importados | `package.json` | **NEEDS VERIFICATION** | `react-popover`, `react-scroll-area`, `react-select`, `react-tabs`, `react-tooltip`, `react-avatar`, `react-progress`, `react-separator`. Peso morto no `node_modules`, não no bundle |
| `@aws-sdk/s3-request-presigner` | `package.json` | **KEEP** | não usado hoje, mas é exatamente a peça para URLs assinadas — a recomendação de [08](08_STORAGE_SECURITY.md) |
| `DocumentVersion.checksum` | `prisma/schema.prisma` | **KEEP** | nunca preenchido, mas é a ferramenta de reconciliação storage × banco |
| `EMAIL_SERVER` / `EMAIL_FROM` | `src/lib/env-schema.ts` | **KEEP** | documentam intenção; remover apaga o placeholder |
| `APP_URL` | `src/lib/env-schema.ts` | **KEEP** | idem; o próprio schema comenta "nothing reads it yet" |
| `SUPPLIER_ROLES` | `src/types/auth.ts` | **KEEP** | é a fonte de `isSupplierRole` no mesmo arquivo |
| `ALLOWED_FILE_TYPES` | `src/lib/upload.ts` | **KEEP** | `ALLOWED_EXTENSIONS` e `validateUpload` derivam dela |
| `LOCALES`, `DEFAULT_SUPPLIER_LOCALE` | `src/lib/i18n/config.ts` | **KEEP** | `LOCALES` alimenta `isLocale` e o tipo `Locale` |
| `src/lib/i18n/dictionaries/zh.ts` | — | **KEEP** | referenciado por `getDictionary`; `Language.ZH` está no enum do banco |
| `.claude-flow/sessions/*.json` (14 não rastreados) | — | **NEEDS VERIFICATION** | artefatos de ferramenta, não de produto. Não estão no `.gitignore` |

## O que **não** foi encontrado

- **Nenhum `TODO`, `FIXME`, `HACK` ou `XXX`** em `src/`, `scripts/`, `prisma/` ou `tests/`.
- **Nenhum `console.log` de depuração** em `src/`.
- Nenhuma rota de debug além de `/demo`.
- Nenhum dado mock fora de `src/server/demo/**`.
- Nenhuma flag temporária.

Para um repositório de 18 mil linhas, isso é notável e merece registro.
