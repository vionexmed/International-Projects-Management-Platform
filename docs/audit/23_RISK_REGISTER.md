# 23 — Registro de riscos

Severidade: **CRITICAL** (leva a comprometimento total ou perda de dados) ·
**HIGH** (impacto sério com caminho plausível) · **MEDIUM** (impacto real,
limitado ou improvável) · **LOW** (higiene).

Prioridade: **P0** (antes de qualquer dado real) · **P1** (antes do piloto) ·
**P2** (antes do rollout global) · **P3** (backlog).

## CRITICAL

| ID | Risco | Evidência | Prob. | Impacto | Prio | Bloqueia produção? |
|---|---|---|---|---|---|---|
| **SEC-001** | `/demo/enter?as=admin` emite sessão de ADMIN sem senha, em qualquer ambiente | `src/lib/demo.ts` → `isDemoEnabled()` retorna `true` literal; `src/app/demo/enter/route.ts` → `GET` | Certa | Comprometimento total | **P0** | **SIM** |
| **SEC-002** | Todas as contas do snapshot têm a senha `vionex123`, inclusive ADMIN | `scripts/build-demo-snapshot.mjs` → `seedDemoData(..., { password: "vionex123" })`, embarcado no bundle pelo script `build` | Certa | Comprometimento total | **P0** | **SIM** |
| **SEC-003** | `AUTH_SECRET` assume chave publicada no repositório; sessões são forjáveis | `src/lib/env-schema.ts` → `DEMO_SIGNING_KEY` como `.default()` | Certa se não configurado | Comprometimento total | **P0** | **SIM** |
| **DB-007** | Sem `DATABASE_URL` a aplicação serve sobre Postgres em memória: escritas perdidas no reciclo, cada instância com seu banco, `/api/health` responde **200 ok** | `src/server/demo/embedded-db.ts` → `shouldUseEmbeddedDatabase()` só checa a variável; `src/lib/env-schema.ts` não a exige em produção | Alta (basta a variável em branco) | Perda silenciosa de dados | **P0** | **SIM** |
| **GLB-002** | "Atrasado" é calculado no fuso do servidor; o prazo está errado em Xangai, em Munique e em São Paulo, e contamina o status do portfólio | `src/lib/format.ts` → `daysUntil`; `src/lib/status.ts` → `deriveTaskStatus`; `dueDate: { lt: new Date() }` em `services/{tasks,suppliers,dashboard}.ts` | Certa | Decisões erradas sobre fornecedores | **P1** | Bloqueia uso global |
| **UX-001** | Formulário é apagado quando a ação falha — o usuário perde tudo o que digitou junto com a mensagem de erro | Verificado em `node_modules/react-dom/cjs/react-dom-client.development.js`: `startHostTransition` chama `requestFormReset$1(formFiber)` **dentro** do wrapper, antes de `action(formData)`. As actions retornam `{error}` em vez de lançar (`src/server/actions/utils.ts`) | Certa | Abandono; fornecedor em rede lenta perde o trabalho | **P1** | Bloqueia piloto |

## HIGH

| ID | Risco | Evidência | Prio | Bloqueia? |
|---|---|---|---|---|
| **TEN-002** | Campos internos da Vionex chegam ao navegador do fornecedor: `ProjectStage.notes`, `Project.blockerNote`, `Project.description`, `Milestone.description` | `src/server/services/projects.ts` → `getProjectWorkspace` sem `select`, chamado pelas páginas dos **dois** ambientes | **P0** | **SIM** |
| **TEST-001** | Os 14 testes de isolamento **são pulados em silêncio** sem banco local; o runner ainda imprime "61 passed" | Reexecutado nesta auditoria: `4 failed \| 6 passed`, `26 skipped`. `tests/setup.ts` checa a existência de `DATABASE_URL`, não a alcançabilidade | **P0** | **SIM** |
| **GOV-001** | O pipeline de CI existe mas **não está instalado** — não há `.github/workflows/`. Todo push vai direto para produção sem lint, tipos, testes ou build | `ci/github-ci.yml` existe; `ls .github` não existe | **P0** | **SIM** |
| **GOV-002** | Nenhuma etapa do deploy aplica migrations. `build` é `demo:snapshot && next build` | `package.json`; sem `vercel.json`, sem `vercel-build`, sem `postbuild` | **P0** | **SIM** |
| **STO-003** | `STORAGE_DRIVER=local` em produção aceita o upload e perde o arquivo no reciclo, sem avisar o usuário | `src/lib/storage/index.ts`; `src/lib/env-schema.ts` dá default `local` e não bloqueia | **P0** | **SIM** |
| **SEC-004** | Injeção de fórmula em CSV com dado controlado pelo fornecedor | `src/lib/csv.ts` → `toCsv` não neutraliza `=`, `+`, `-`, `@`; `src/app/api/reports/[report]/route.ts` exporta nomes de projeto, fornecedor e documento | **P1** | Não |
| **SEC-005** | Throttle por IP contornável — `X-Forwarded-For` é lido do cliente sem cadeia de proxy confiável | `src/server/auth/throttle.ts` → `clientIp()` | **P1** | Não |
| **SEC-006** | Nenhuma verificação do conteúdo real do arquivo, nenhum antivírus. Conta de fornecedor comprometida distribui malware à Vionex | `src/lib/upload.ts` → `validateUpload` confia em `file.type` | **P1** | Não |
| **SEC-007** | Sem MFA; trocar a senha **não** invalida sessões; token válido por até 30 dias | `src/server/auth/session.ts`; `User` sem `tokenVersion` | **P1** | Não |
| **OPS-001** | Observabilidade zero: um erro em produção não notifica ninguém. O `error.digest` mostrado ao usuário não tem contraparte em lugar nenhum | Sem logger, Sentry, métricas ou tracing em `package.json` e em `src/` | **P1** | **SIM** |
| **OPS-002** | Audit log é write-only, sem leitura na aplicação, sem proteção no banco, e **perde entradas em silêncio** | `src/server/services/audit.ts` → `recordAudit` engole falhas; zero referências de leitura a `auditLog.` em `src/app/`, `src/features/`, `src/components/` | **P1** | Não |
| **DB-001** | `DocumentRequestReply.authorId` sem FK: autoria da resposta do fornecedor não é rastreável | `prisma/schema.prisma`; a migration adiciona só `requestId_fkey` | **P1** | Não |
| **DB-002** | `AuditLog` é apagado em cascata com a `Organization` | `AuditLog_organizationId_fkey ... ON DELETE CASCADE` | **P1** | Não |
| **DB-003** | Política de autoria incoerente: Restrict em 4 tabelas, Cascade em 2, sem FK em 1. Apagar um fornecedor destrói conversas do lado Vionex | `prisma/migrations/20260902195200_init/migration.sql` | **P1** | Não |
| **DB-006** | `DocumentRequest` não carrega `organizationId`, contrariando o cabeçalho do próprio schema | `prisma/schema.prisma`; `documentRequestScope` amarra o tenant só pelo join | **P2** | Não |
| **DB-008** | Sem RLS: uma única consulta sem escopo vaza, e não há rede embaixo. 16 de 23 tabelas nem têm coluna de tenant para uma policy futura | Busca exaustiva por `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY`: zero | **P2** | Não |
| **UX-002** | Upload sem qualquer indicação de progresso — o único sinal é o botão virar `"…"` | `src/features/supplier-portal/submit-request-form.tsx` | **P1** | Não |
| **UX-003** | `FileDropzone` mostra arquivo fantasma após o envio: `form.reset()` limpa o input nativo, não o estado React | `src/components/app/file-dropzone.tsx` | **P1** | Não |
| **UX-011** | Listas truncadas em silêncio: `perPage: 100`/`50` sem paginação em 5 telas | `supplier/documents`, `supplier/projects`, `projects/[id]/{documents,tasks,regulatory}` | **P2** | Não |
| **UX-012** | Fornecedor no celular **não consegue sair nem trocar de idioma** — ambos só existem na sidebar `hidden md:flex` | `src/components/app/supplier-mobile-nav.tsx` | **P1** | Não |
| **UX-009** | `text-faint` (#8b98a3) = **2.79:1** sobre o canvas: é o placeholder de todos os campos, todos os timestamps e o e-mail no menu de conta | `src/app/globals.css`; cálculo em [11_UI_UX_AUDIT.md](11_UI_UX_AUDIT.md) | **P2** | Não |
| **UX-008** | Foco de teclado praticamente invisível: menus a **1.09:1**, anel de input a **1.18:1**, paleta de comandos sem substituto | `src/components/ui/dropdown.tsx`, `input.tsx`, `src/components/app/command-palette.tsx` | **P2** | Não |
| **UX-006** | `<html lang="pt-BR">` para todo o produto, inclusive o portal em inglês (WCAG 3.1.1) | `src/app/layout.tsx` | **P2** | Não |
| **GLB-010** | ~520 literais hardcoded em 66 arquivos de UI | contagem em [31_I18N_AND_LOCALIZATION.md](31_I18N_AND_LOCALIZATION.md) | **P2** | Bloqueia global |
| **GLB-011** | Português vaza para dentro do portal: faixa de demo, erros de upload, "Cancelar", `aria-label="Fechar"`, 404 global | 7 componentes compartilhados | **P1** | Bloqueia global |
| **GLB-012** | A tela de login está **sempre** em português, para todos os fornecedores | `src/app/(auth)/login/page.tsx` fixa `DEFAULT_INTERNAL_LOCALE` | **P1** | Bloqueia global |
| **GLB-013** | Mensagens de erro do servidor chegam ao fornecedor em português | `toActionError`, `authz/errors.ts`, `authz/access.ts`, `lib/upload.ts` | **P1** | Bloqueia global |
| **GLB-014** | O idioma está **gravado na linha**: toda a timeline que o fornecedor vê está em português no banco | `recordTimelineEvent` com `internal: false`; nenhuma chamada em `services/` passa `internal: true` | **P2** | Bloqueia global |
| **PERF-001** | `getPortfolioProgress` carrega todos os projetos com todas as etapas e todas as tarefas, sem limite — e alimenta `/reports` e o CSV | `src/server/services/dashboard.ts` | **P2** | Não |
| **SEC-008** | `toActionError` devolve ao usuário qualquer `Error` com menos de 200 caracteres, incluindo erros de driver e de configuração | `src/server/actions/utils.ts` | **P1** | Não |

## MEDIUM

| ID | Risco | Evidência | Prio |
|---|---|---|---|
| **ARCH-001** | 11 páginas consultam o banco direto. Hoje todas aplicam o escopo — verificado —, mas nada impede a próxima de esquecer | listadas em [02_CURRENT_ARCHITECTURE.md](02_CURRENT_ARCHITECTURE.md) | P2 |
| **REL-001** | Objeto órfão no storage quando a transação falha; sem compensação e sem varredura | `services/documents.ts` → `uploadDocument` escreve antes da `$transaction` | P2 |
| **REL-002** | `submitDocumentRequest` encadeia duas transações: documento entregue com solicitação ainda `PENDING` | mesma função | P1 |
| **REL-003** | Sem timeout em nenhuma chamada externa; o AWS SDK ainda tenta 3 vezes por padrão | `src/lib/storage/s3.ts`; `src/server/db.ts` | P2 |
| **REL-004** | `ensureProjectThread` duplica threads sob concorrência — falta `@@unique([projectId, withSupplier])` | `src/server/services/messages.ts` | P2 |
| **REL-005** | Duplo clique duplica solicitações, tarefas, mensagens e **notificações ao fornecedor** | sem idempotência em nenhuma action | P2 |
| **SEC-009** | `/api/health` é público e conta a um anônimo que a chave de assinatura é a publicada | `src/app/api/health/route.ts` | P1 |
| **SEC-010** | Sem rate limit fora do login | `/api/search`, `/api/files`, 12 server actions | P2 |
| **AUTH-001** | `VIEWER` pode baixar qualquer documento, inclusive `INTERNAL_ONLY` | `INTERNAL_READ` em `permissions.ts` | P2 |
| **DB-005** | Sem unicidade em `MessageThread` e `Milestone.position` | `prisma/schema.prisma` | P2 |
| **DB-009** | Pool sem configuração: default de 10 conexões por processo, sem `statement_timeout` | `src/server/db.ts` | P1 |
| **DB-010** | Índices de ordenação ausentes nas três listas paginadas quentes; busca `ILIKE` sem `pg_trgm` | ver [05_DATABASE_AUDIT.md](05_DATABASE_AUDIT.md) | P2 |
| **GLB-016** | `zh` alcançável por server action apesar de removido do seletor | `preferences.ts` valida com `isLocale`, não `SELECTABLE_LOCALES` | P3 |
| **GLB-017** | País é texto livre, não ISO 3166 — variantes de grafia fragmentam o filtro | `Supplier.country`, `Project.country` | P2 |
| **UX-014/015/016** | Três afordâncias mentirosas: ícone de mensagens → `/projects`; sino do portal → `/action-required`; itens de menu que prometem ação e só navegam | `topbar.tsx`, `(supplier)/supplier/layout.tsx`, `project-actions-menu.tsx` | P2 |
| **UX-010** | 16 rotas de detalhe sem `loading.tsx`, incluindo as 9 abas de projeto | ver [11_UI_UX_AUDIT.md](11_UI_UX_AUDIT.md) | P2 |
| **UX-013** | 404 do fornecedor cai em página portuguesa que oferece `/dashboard`, de onde ele é redirecionado de volta | `src/app/not-found.tsx` | P2 |
| **UX-025** | Classes de animação declaradas sem o plugin instalado — diálogos e menus aparecem secamente | `dialog.tsx`, `dropdown.tsx`; `tailwindcss-animate` ausente | P3 |
| **PERF-002** | 14+ `findMany` sem limite; `include` pesados nos guards de acesso | ver [18_PERFORMANCE.md](18_PERFORMANCE.md) | P2 |
| **PERF-003** | Snapshot de 6,4 MB gerado e empacotado em **todo** build, inclusive com `DATABASE_URL` configurado | `package.json`, `scripts/build-demo-snapshot.mjs` | P2 |
| **GOV-003** | Branch única `main`, sem staging, sem PR, sem preview, sem `vercel.json` versionado | `git branch -a` | P1 |

## LOW

`SEC-011` (CSP não cobre `/api`) · `STO-004` (sem SSE declarado) ·
`AUTH-002` (`portal:manage-users` sem implementação) ·
`AUTH-003` (papéis de etapa podem atualizar qualquer projeto) ·
`DB-004` (sem caminho de exclusão de usuário) ·
`DB-011` (2 índices redundantes + 1 morto) ·
`OPS-003` (`/api/search` devolve 500 com corpo de sucesso) ·
`OPS-004` (duas actions falham em silêncio total) ·
`UX-032` (checkbox 16×16 falha SC 2.5.8) ·
`GLB-020` (`Content-Disposition` sem fallback ASCII) ·
`GLB-021` (saudação calculada no fuso do servidor) ·
`CLN-*` (código morto — ver [24_CLEANUP_CANDIDATES.md](24_CLEANUP_CANDIDATES.md))

## Totais

| Severidade | Quantidade |
|---|---|
| CRITICAL | **6** |
| HIGH | **28** |
| MEDIUM | **24** |
| LOW | **13** |
| **Total** | **71** |

**Bloqueiam produção: 10** (SEC-001, SEC-002, SEC-003, DB-007, TEN-002, TEST-001,
GOV-001, GOV-002, STO-003, OPS-001).

**Bloqueiam uso global: 6** (GLB-002, GLB-011, GLB-012, GLB-013, GLB-014, GLB-010).
