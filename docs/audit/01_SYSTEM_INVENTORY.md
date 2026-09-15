# 01 — Inventário do sistema

Commit auditado: `af823ff`. Contagens verificadas com `find`/`wc` em 14/09/2026.

## Stack

| Camada | Tecnologia | Versão instalada |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.4 |
| Runtime | Node.js | 24 (definido em `ci/github-ci.yml`) |
| Linguagem | TypeScript | 5.9.3 (modo estrito — `tsconfig.json`) |
| UI | React | 19.2.8 |
| Estilo | Tailwind CSS | 4 (via `@tailwindcss/postcss`) |
| Primitivos de UI | Radix UI | 14 pacotes |
| ORM | Prisma | 7.10.0 com driver adapter `@prisma/adapter-pg` |
| Banco | PostgreSQL | via `pg` 8.23 |
| Validação | Zod | 4.5.4 |
| Sessão | `jose` (JWT HS256) | 6.2.10 |
| Hash de senha | `bcryptjs` | 3.0.3, custo 12 |
| Storage | `@aws-sdk/client-s3` ou filesystem | 3.1125.0 |
| Testes | Vitest | 4.1.11 |

## Tamanho

| Métrica | Valor |
|---|---|
| Arquivos `.ts`/`.tsx` (excluindo cliente Prisma gerado) | 186 |
| Linhas de código (idem) | 18.038 |
| Maior arquivo | `src/server/services/documents.ts` — 443 linhas |
| Arquivos acima de 500 linhas | **0** |
| Componentes cliente (`"use client"`) | 41 |
| Migrations | 2 |
| Modelos Prisma | 26 |

Nenhum arquivo passa de 500 linhas e não existe god service. A base é pequena e
navegável — um ponto forte real, registrado em [37_DO_NOT_TOUCH.md](37_DO_NOT_TOUCH.md).

## Mapa de diretórios

```
src/
  app/
    (auth)/login/          tela de login
    (internal)/            ambiente Vionex — português
    (supplier)/supplier/   Supplier Portal — inglês
    api/                   4 route handlers
    demo/                  seletor de conta SEM SENHA  ← ver SEC-001
  components/
    app/      componentes de layout (sidebars, topbar, nav)
    ui/       design system (14 primitivos)
  features/   diálogos e formulários por domínio
  lib/        env, i18n, storage, format, csv, upload, utils
  server/
    actions/    12 server actions ("use server")
    auth/       sessão, senha, throttle, current-user
    authz/      scopes, access, permissions, errors, rsc   ← núcleo de isolamento
    services/   12 serviços de domínio
    demo/       banco embutido PGlite + seed
  types/
prisma/
  schema.prisma
  migrations/  20260902195200_init, 20260909155300_login_throttle
```

## Superfícies de entrada

| Superfície | Quantidade | Autenticação |
|---|---|---|
| Páginas RSC internas | ~25 rotas | `requireInternalUser()` no layout |
| Páginas RSC do portal | ~10 rotas | `requireSupplierUser()` no layout |
| Route handlers | 4 | ver abaixo |
| Server actions | 12 arquivos | `requirePermission()` por ação |
| Proxy (ex-middleware) | `src/proxy.ts` | **apenas headers, nenhuma autorização** |

### Route handlers

| Rota | Autenticação | Autorização | Observação |
|---|---|---|---|
| `GET /api/files/[versionId]` | `getCurrentUser()` → 401 | `requireDocumentVersionAccess` re-aplica o escopo | correto |
| `GET /api/reports/[report]` | `getCurrentUser()` → 401 | nega fornecedor + `report:read` | cabeçalhos CSV só em português |
| `GET /api/search` | `getCurrentUser()` → 401 | escopo dentro de `search()` | sem rate limit |
| `GET /api/health` | **nenhuma** | — | expõe estado de configuração; ver SEC-009 |
| `GET /demo/enter` | **nenhuma** | **nenhuma** | emite sessão de ADMIN ← **SEC-001** |

## Serviços externos

| Serviço | Estado |
|---|---|
| E-mail | **Não implementado.** `EMAIL_SERVER` existe em `src/lib/env-schema.ts` mas nenhum código o lê. Nenhum e-mail é enviado. |
| Webhooks | Nenhum. |
| Cron / jobs agendados | Nenhum. |
| Analytics / telemetria | Nenhum. |
| Monitoramento de erros | Nenhum. |
| Object storage | S3 compatível, opcional (`STORAGE_DRIVER=s3`). Hoje `local`. |
| Chamadas externas do browser | Apenas `fetch("/api/search")` em `src/components/app/command-palette.tsx` — mesma origem. |

A superfície de integração é praticamente zero. Isso reduz muito o risco de
cadeia de suprimentos e ajuda no acesso da China, mas significa que **não existe
nenhum canal de notificação fora da plataforma** — um fornecedor em Xangai só
descobre que há um documento pendente se entrar no portal. Ver GLB-006.

## Dependências sem uso aparente

| Pacote | Evidência |
|---|---|
| `@aws-sdk/s3-request-presigner` | `grep -rn "getSignedUrl\|s3-request-presigner" src/ scripts/` não retorna nada |

Classificado como NEEDS VERIFICATION em [24_CLEANUP_CANDIDATES.md](24_CLEANUP_CANDIDATES.md):
ele provavelmente foi adicionado prevendo URLs assinadas, que é justamente o que
[08_STORAGE_SECURITY.md](08_STORAGE_SECURITY.md) recomenda para entrega global.
