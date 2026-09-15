# 39 — Índice de evidências

Cada achado CRITICAL, cada HIGH, cada bloqueador de produção e cada bloqueador
global aparece aqui com o caminho exato do arquivo. Onde não há número de linha,
é porque o arquivo muda — a referência é por função, model ou constante, que é
estável. **Nenhum número de linha foi inventado.**

Status: **CONFIRMED** (lido no código) · **PARTIALLY CONFIRMED** (indício forte,
falta verificação em ambiente real) · **NOT CONFIRMED** (hipótese testada e
refutada — registrada porque o resultado negativo também é evidência).

## CRITICAL

| ID | Domínio | Descrição | Evidência | Doc | Status |
|---|---|---|---|---|---|
| **SEC-001** | Authentication | `/demo/enter` emite sessão de ADMIN sem senha, em qualquer ambiente | `src/lib/demo.ts` → `isDemoEnabled()` (corpo é `return true;`); `src/app/demo/enter/route.ts` → `GET`, constante `DEMO_ACCOUNTS`; `src/app/page.tsx` → `RootPage` redireciona anônimos para `/demo` | [03](03_SECURITY_AUDIT.md) | **CONFIRMED** |
| **SEC-002** | Credentials | Todas as contas do snapshot têm senha `vionex123`, inclusive ADMIN | `scripts/build-demo-snapshot.mjs` → `seedDemoData(client, { password: "vionex123", storage: null })`; `package.json` → script `build`; `src/server/demo/embedded-db.ts` carrega o snapshot | [03](03_SECURITY_AUDIT.md) | **CONFIRMED** |
| **SEC-003** | Credentials | `AUTH_SECRET` assume chave publicada no repositório | `src/lib/env-schema.ts` → constante `DEMO_SIGNING_KEY`, usada como `.default()` de `AUTH_SECRET`; `src/server/auth/session.ts` → `signingKey()` | [03](03_SECURITY_AUDIT.md) | **CONFIRMED** |
| **DB-007** | Database | Sem `DATABASE_URL` a aplicação serve sobre Postgres em memória; health responde 200 | `src/server/demo/embedded-db.ts` → `shouldUseEmbeddedDatabase()`; `src/lib/env-schema.ts` → `DATABASE_URL: z.string().optional()` e o `superRefine` que não a exige em produção; `src/app/api/health/route.ts` → `GET` devolve `status: "ok"` com `database: "embedded (in-memory)"` | [05](05_DATABASE_AUDIT.md), [14](14_ENVIRONMENT_AUDIT.md) | **CONFIRMED** |
| **GLB-002** | Timezone | "Atrasado" calculado no fuso do servidor; errado em Xangai, Munique e São Paulo | `src/lib/format.ts` → `daysUntil` (`new Date()` + `setHours(0,0,0,0)`); `src/lib/status.ts` → `deriveTaskStatus`; `src/server/services/project-health.ts` → `isOverdue` e `deriveProjectStatus`; `dueDate: { lt: new Date() }` em `src/server/services/{tasks,suppliers,dashboard}.ts` | [32](32_TIMEZONE_STRATEGY.md) | **CONFIRMED** |
| **UX-001** | Frontend | Formulário apagado quando a ação falha | `node_modules/react-dom/cjs/react-dom-client.development.js` → `startHostTransition` chama `requestFormReset$1(formFiber)` dentro do wrapper, antes de `action(formData)` — **lido diretamente no fonte**; `src/server/actions/utils.ts` → `toActionError` retorna, não lança; `src/components/app/form-dialog.tsx`; `src/features/supplier-portal/submit-request-form.tsx` | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |

## HIGH — bloqueadores de produção

| ID | Domínio | Descrição | Evidência | Doc | Status |
|---|---|---|---|---|---|
| **TEN-002** | Multitenancy | Campos internos da Vionex chegam ao navegador do fornecedor | `src/server/services/projects.ts` → `getProjectWorkspace` (`db.projectStage.findMany` e `db.milestone.findMany` sem `select`); chamado por `src/app/(supplier)/supplier/projects/[projectId]/page.tsx` **e** `src/app/(internal)/projects/[projectId]/page.tsx`; campos em `prisma/schema.prisma` → models `ProjectStage` (`notes`), `Project` (`blockerNote`, `description`), `Milestone` (`description`) | [07](07_RLS_AND_MULTITENANCY.md) | **CONFIRMED** |
| **TEST-001** | Testing | Os 14 testes de isolamento são pulados em silêncio sem banco | `npm test` reexecutado nesta auditoria: `Test Files 4 failed \| 6 passed`, `Tests 9 failed \| 61 passed \| 26 skipped`; `tests/setup.ts` verifica a existência de `DATABASE_URL`, não a alcançabilidade; `lsof -nP -iTCP:5433 -sTCP:LISTEN` vazio | [20](20_TEST_STRATEGY.md) | **CONFIRMED** |
| **GOV-001** | Governance | CI escrito e não instalado | `ci/github-ci.yml` existe; `ls .github` falha — não há `.github/workflows/` | [13](13_ENGINEERING_GOVERNANCE.md) | **CONFIRMED** |
| **GOV-002** | Governance | Deploy não aplica migrations | `package.json` → `"build": "npm run demo:snapshot && next build"`; ausência de `vercel.json`, `vercel-build`, `postbuild` | [13](13_ENGINEERING_GOVERNANCE.md) | **CONFIRMED** |
| **STO-003** | Storage | `STORAGE_DRIVER=local` em produção perde documentos sem avisar | `src/lib/storage/index.ts` → `storage()` cai no driver local por default; `src/lib/env-schema.ts` → `STORAGE_DRIVER` com `.default("local")` e sem bloqueio em produção; `src/app/api/health/route.ts` reporta só como warning | [08](08_STORAGE_SECURITY.md) | **CONFIRMED** |
| **OPS-001** | Observability | Nenhum mecanismo de observabilidade | `package.json` sem logger, Sentry, OpenTelemetry ou métricas; 13 `console.error` em `src/` são o único sinal; `error.digest` exibido em 4 boundaries sem contraparte | [17](17_OBSERVABILITY.md) | **CONFIRMED** |

## HIGH — demais

| ID | Domínio | Descrição | Evidência | Doc | Status |
|---|---|---|---|---|---|
| **SEC-004** | API Security | Injeção de fórmula em CSV com dado do fornecedor | `src/lib/csv.ts` → `toCsv` (regex `/[",\n;]/` não cobre `=`, `+`, `-`, `@`); `src/app/api/reports/[report]/route.ts` exporta `project.name`, `supplier.name`, `request.title`, `document.name` | [03](03_SECURITY_AUDIT.md) | **CONFIRMED** |
| **SEC-005** | Authentication | Throttle por IP contornável | `src/server/auth/throttle.ts` → `clientIp()` lê a entrada mais à esquerda de `x-forwarded-for` sem cadeia de proxy confiável | [03](03_SECURITY_AUDIT.md), [04](04_AUTH_AND_AUTHORIZATION.md) | **CONFIRMED** |
| **SEC-006** | Upload | Sem verificação do conteúdo real, sem antivírus | `src/lib/upload.ts` → `validateUpload` usa `ALLOWED_FILE_TYPES[file.type]`, e `file.type` é declarado pelo cliente | [03](03_SECURITY_AUDIT.md), [08](08_STORAGE_SECURITY.md) | **CONFIRMED** |
| **SEC-007** | Authentication | Sem MFA; troca de senha não invalida sessões; token válido 30 dias | `src/server/auth/session.ts` → `REMEMBERED_SESSION_SECONDS`; `prisma/schema.prisma` → model `User` sem `tokenVersion`/`sessionsValidFrom`; nenhuma ocorrência de TOTP/WebAuthn no repositório | [04](04_AUTH_AND_AUTHORIZATION.md) | **CONFIRMED** |
| **SEC-008** | Error handling | `toActionError` devolve qualquer `Error` com menos de 200 caracteres | `src/server/actions/utils.ts` → `toActionError`, ramo `error.message.length < 200`. Strings alcançáveis: `src/lib/storage/index.ts` → `storage()`; `src/lib/storage/local.ts` → `resolveKey`; `src/server/authz/scopes.ts` → `supplierIdOf`; `src/lib/env.ts` → `load()` | [03](03_SECURITY_AUDIT.md) | **CONFIRMED** para o mecanismo e para essas quatro strings |
| **SEC-008b** | Error handling | Mensagens de `PrismaClientInitializationError` (host e porta) alcançariam a UI | mesmo ramo; `PrismaClientInitializationError` não cai no ramo `PrismaClientKnownRequestError` | [03](03_SECURITY_AUDIT.md) | **PARTIALLY CONFIRMED** — string exata do Prisma 7 não observada em runtime |
| **OPS-002** | Audit | Audit log write-only, sem leitura, sem proteção, lossy | `src/server/services/audit.ts` → `recordAudit` (`try/catch` que só loga); zero referências a `auditLog.` em `src/app/`, `src/features/`, `src/components/`; sem trigger ou `REVOKE` em `prisma/migrations/**` | [12](12_DATA_GOVERNANCE.md), [17](17_OBSERVABILITY.md) | **CONFIRMED** |
| **DB-001** | Database | `DocumentRequestReply.authorId` sem FK | `prisma/schema.prisma` → model `DocumentRequestReply` (campo `authorId String` sem `@relation`); `prisma/migrations/20260902195200_init/migration.sql` → única constraint é `DocumentRequestReply_requestId_fkey`. **Verificado duas vezes** | [05](05_DATABASE_AUDIT.md) | **CONFIRMED** |
| **DB-002** | Database | `AuditLog` apagado em cascata com a organização | `prisma/migrations/20260902195200_init/migration.sql` → `AuditLog_organizationId_fkey ... ON DELETE CASCADE` | [05](05_DATABASE_AUDIT.md) | **CONFIRMED** |
| **DB-003** | Database | Política de autoria incoerente entre 7 relações | mesma migration: `Task_createdById_fkey`, `Document_createdById_fkey`, `DocumentVersion_uploadedById_fkey`, `DocumentRequest_requestedById_fkey` (RESTRICT) versus `TaskComment_authorId_fkey`, `Message_senderId_fkey` (CASCADE) versus `DocumentRequestReply.authorId` (sem FK) | [05](05_DATABASE_AUDIT.md) | **CONFIRMED** |
| **DB-006** | Multitenancy | `DocumentRequest` sem `organizationId` | `prisma/schema.prisma` → model `DocumentRequest` (só `supplierId` e `projectId`); `src/server/authz/scopes.ts` → `documentRequestScope` amarra o tenant só por `{ project: { organizationId } }`. **Verificado** | [05](05_DATABASE_AUDIT.md), [07](07_RLS_AND_MULTITENANCY.md) | **CONFIRMED** |
| **DB-008** | Multitenancy | Nenhuma RLS em lugar nenhum | busca exaustiva por `CREATE POLICY`, `ENABLE ROW LEVEL SECURITY`, `ALTER TABLE ... FORCE` em `src/`, `prisma/`, `scripts/`, `ci/`: zero ocorrências | [07](07_RLS_AND_MULTITENANCY.md) | **CONFIRMED** |
| **PERF-001** | Performance | `getPortfolioProgress` sem limite, alimenta `/reports` e o CSV | `src/server/services/dashboard.ts` → `getPortfolioProgress` | [18](18_PERFORMANCE.md) | **CONFIRMED** |
| **UX-002** | UX | Upload sem indicação de progresso | `src/features/supplier-portal/submit-request-form.tsx` (`{pending ? "…" : label}`); `src/components/app/file-dropzone.tsx` | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |
| **UX-003** | UX | Arquivo fantasma após o envio | `src/components/app/file-dropzone.tsx` (estado React não sincronizado com `form.reset()`) | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |
| **UX-008** | Accessibility | Foco de teclado invisível | `src/components/ui/dropdown.tsx` (`outline-none` + `bg-raised` = 1,09:1); `src/components/app/command-palette.tsx` (`focus:outline-none` sem substituto); `src/components/ui/input.tsx` (anel a 1,18:1) | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |
| **UX-009** | Accessibility | `text-faint` a 2,79:1 em todos os placeholders | `src/app/globals.css` → `--color-faint: #8b98a3`; cálculo em [11](11_UI_UX_AUDIT.md) | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |
| **UX-012** | UX | Fornecedor no celular não consegue sair nem trocar idioma | `src/components/app/supplier-sidebar.tsx` (`hidden md:flex`, contém `LanguagePicker` e logout); `src/components/app/supplier-mobile-nav.tsx` (só os 5 links) | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |
| **UX-011** | UX | Listas truncadas em silêncio | `src/app/(supplier)/supplier/documents/page.tsx`, `.../projects/(index)/page.tsx`, `src/app/(internal)/projects/[projectId]/{documents,tasks,regulatory}/page.tsx` | [11](11_UI_UX_AUDIT.md) | **CONFIRMED** |

## HIGH — bloqueadores globais

| ID | Descrição | Evidência | Doc | Status |
|---|---|---|---|---|
| **GLB-010** | ~520 literais hardcoded em 66 arquivos | contagem por extração de literais visíveis em `src/app/**`, `src/features/**`, `src/components/**`; piores: `src/app/(internal)/settings/page.tsx` (33), `dashboard/page.tsx` (24), `reports/page.tsx` (22) | [31](31_I18N_AND_LOCALIZATION.md) | **CONFIRMED** |
| **GLB-011** | Português vaza no portal por componentes compartilhados | `src/components/app/demo-banner.tsx`, `file-dropzone.tsx`, `form-dialog.tsx`, `tabs-nav.tsx`, `pagination.tsx`; `src/components/ui/dialog.tsx`; `src/app/not-found.tsx` | [31](31_I18N_AND_LOCALIZATION.md) | **CONFIRMED** |
| **GLB-012** | Login sempre em português | `src/app/(auth)/login/page.tsx` → `const locale = DEFAULT_INTERNAL_LOCALE`. **Verificado**. Zero ocorrências de `accept-language` ou `navigator.language` em `src/` | [31](31_I18N_AND_LOCALIZATION.md) | **CONFIRMED** |
| **GLB-013** | Erros do servidor em português no portal | `src/server/actions/utils.ts` → `toActionError`; `src/server/authz/errors.ts`; `src/server/authz/access.ts` (7 mensagens); `src/lib/upload.ts` → `validateUpload`; renderizado cru por `src/features/supplier-portal/submit-request-form.tsx` | [31](31_I18N_AND_LOCALIZATION.md) | **CONFIRMED** |
| **GLB-014** | Idioma gravado na linha (timeline visível ao fornecedor) | `src/server/services/timeline.ts` → `recordTimelineEvent` (`internal: input.internal ?? false`); **verificado: nenhuma chamada em `src/server/services/` passa `internal: true`**; descrições em `src/server/services/{projects,tasks,documents,messages}.ts`; `src/server/authz/scopes.ts` → `timelineScope` | [31](31_I18N_AND_LOCALIZATION.md) | **CONFIRMED** |
| **GLB-015** | `getDictionary` entrega chinês para qualquer locale novo | `src/lib/i18n/dictionary.ts` → `getDictionary`, ternário cujo braço final é `merge(english, zh)`. **Verificado** | [31](31_I18N_AND_LOCALIZATION.md) | **CONFIRMED (latente)** — hoje `LOCALES` tem só os 3 tratados |
| **GLB-001** | `formatDateTime` sem `timeZone` | `src/lib/format.ts` — única das 5 funções sem `timeZone: "UTC"` | [32](32_TIMEZONE_STRATEGY.md) | **CONFIRMED** |
| **GLB-018** | China: hospedagem não verificável no código | `src/lib/env-schema.ts` referencia `VERCEL_URL`. Acessibilidade, latência e ICP de `*.vercel.app` a partir da China continental **não são verificáveis por leitura de código** | [35](35_CHINA_ACCESS_READINESS.md) | **NOT CONFIRMED — exige teste real** |

## Hipóteses testadas e refutadas

Registradas porque um resultado negativo também é evidência, e porque impedem
que alguém "corrija" algo que já está certo.

| Hipótese | Resultado | Evidência |
|---|---|---|
| Existe IDOR nas rotas com identificador | **refutada** | as 7 guardas de `src/server/authz/access.ts` compõem o escopo dentro do `findFirst`; todas as rotas parametrizadas verificadas |
| Fornecedor A alcança dados do Fornecedor B | **refutada** | as 8 funções de `src/server/authz/scopes.ts` |
| Há `onClick` em `div`/`span`/`li` | **refutada** | os 19 `onClick` estão todos em `<button>`/`<Button>` |
| Há páginas sem `h1` ou com dois | **refutada** | exatamente um `h1` nas 32 rotas |
| `prefers-reduced-motion` é ignorado | **refutada** | implementado em `globals.css`, fora de `@layer`, com `!important` |
| Há injeção de SQL | **refutada** | só um tagged template sem interpolação e um `$executeRawUnsafe` com literal estática guardada por ambiente |
| Há N+1 | **refutada** | `grep -rn "map(async\|Promise.all(.*map"` em `src/server` e `src/app`: zero |
| Faltam cabeçalhos de segurança | **refutada** | `next.config.ts` traz HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP, X-Frame-Options |
| Não há rate limiting no login | **refutada** | `src/server/auth/throttle.ts`, persistido no banco |
| `Content-Disposition` quebra nome chinês | **refutada** | `filename*=UTF-8''` (RFC 5987) em `src/app/api/files/[versionId]/route.ts` |
| O modelo é brasileiro (CEP/CNPJ/CPF) | **refutada** | zero ocorrências em todo o repositório |
| Há drift entre schema e migrations | **refutada** | contagens conferem item a item |
| Há segredos versionados | **refutada** | só placeholders em `.env.example`, `ci/` e `tests/` |
