# 21 — Registro de dívida técnica

Esforço: **P** (horas) · **M** (dias) · **G** (semanas).

| ID | Descrição | Evidência | Impacto | Prob. | Sev. | Esforço | Fase |
|---|---|---|---|---|---|---|---|
| TD-01 | `isDemoEnabled()` constante — o andaime de demonstração não é isolável por configuração | `src/lib/demo.ts` | comprometimento total | certa | CRITICAL | **P** | A |
| TD-02 | Senha de seed publicada no snapshot do build | `scripts/build-demo-snapshot.mjs` | comprometimento total | certa | CRITICAL | **P** | A |
| TD-03 | `AUTH_SECRET` com default público | `src/lib/env-schema.ts` | comprometimento total | certa | CRITICAL | **P** | A |
| TD-04 | Banco embutido alcançável em produção, com health 200 | `src/server/demo/embedded-db.ts` | perda de dados | alta | CRITICAL | **P** | A |
| TD-05 | CI escrito e não instalado | `ci/github-ci.yml` sem `.github/workflows/` | regressão em produção | alta | HIGH | **P** | A |
| TD-06 | Suíte de testes falha em aberto sem banco | `tests/setup.ts` | falsa confiança | certa | HIGH | **P** | A |
| TD-07 | Deploy não aplica migrations | `package.json` | schema divergente | média | HIGH | **P** | A |
| TD-08 | Campos internos no payload do fornecedor | `getProjectWorkspace` | confidencialidade | certa | HIGH | **P** | D |
| TD-09 | Formulário apagado quando a ação falha | React 19 `requestFormReset` | abandono | certa | CRITICAL | **M** | L |
| TD-10 | "Atrasado" no fuso do servidor | `daysUntil`, `deriveTaskStatus` | decisões erradas | certa | CRITICAL | **G** | I |
| TD-11 | Nenhum campo `DATE`, nenhum `timestamptz`, nenhum fuso de usuário | `prisma/schema.prisma` | base do TD-10 | certa | HIGH | **G** | E+I |
| TD-12 | ~520 literais hardcoded | 66 arquivos | bloqueia equipe internacional | certa | HIGH | **G** | I |
| TD-13 | Idioma gravado na linha (timeline, notificações) | `recordTimelineEvent` | não corrigível em runtime | certa | HIGH | **G** | I |
| TD-14 | Observabilidade zero | `package.json` | cegueira operacional | certa | HIGH | **M** | J |
| TD-15 | Audit log write-only, lossy, desprotegido | `recordAudit` | trilha não confiável | média | HIGH | **M** | J |
| TD-16 | Política de integridade incoerente (7 relações) | `migration.sql` | perda de histórico | baixa | HIGH | **M** | E |
| TD-17 | 16 de 23 tabelas sem coluna de tenant; nenhuma RLS | `schema.prisma` | sem segunda linha de defesa | média | HIGH | **G** | E |
| TD-18 | Sem timeout, sem idempotência, sem compensação de falha parcial | `s3.ts`, `db.ts`, `documents.ts` | estados inconsistentes | média | MEDIUM | **M** | H |
| TD-19 | 14+ consultas sem limite; índices de ordenação ausentes; busca sem `pg_trgm` | `services/**` | degrada com o uso | alta | MEDIUM | **M** | M |
| TD-20 | Design system sem tokens de tipografia, espaçamento e sombra — 363 valores arbitrários | `globals.css` + todo `src/` | inconsistência crescente | certa | MEDIUM | **M** | L |
| TD-21 | Classes de animação sem o plugin instalado | `dialog.tsx`, `dropdown.tsx` | interface seca | certa | LOW | **P** | L |
| TD-22 | 11 páginas consultando o banco direto | ver [02](02_CURRENT_ARCHITECTURE.md) | risco futuro de vazamento | baixa | MEDIUM | **P** | F |
| TD-23 | Serviços lançando `Error` genérico; `toActionError` por comprimento | `documents.ts`, `utils.ts` | vazamento de internos | média | MEDIUM | **P** | C |
| TD-24 | Onze pares de cor falham contraste AA | `globals.css` | acessibilidade | certa | MEDIUM | **M** | L |
| TD-25 | Foco de teclado invisível em menus e paleta | `dropdown.tsx`, `command-palette.tsx` | acessibilidade | certa | MEDIUM | **P** | L |
| TD-26 | Snapshot de 6,4 MB em todo build | `package.json` | build e deploy inflados | certa | MEDIUM | **P** | A |
| TD-27 | 59 `revalidatePath` que não invalidam nada | `actions/**` | contrato mal-entendido | — | LOW | **P** | M |
| TD-28 | Sem caminho de exclusão de dado pessoal | 6 FKs `Restrict` | conformidade | média | HIGH | **G** | — |
| TD-29 | Cinco server actions sem consumidor; `project.archive` nunca emitido | ver [38](38_UNRESOLVED_QUESTIONS.md) | funcionalidade incompleta | — | LOW | **?** | — |
| TD-30 | 8 pacotes Radix instalados e nunca importados | `package.json` | peso morto | — | LOW | **P** | — |

## Dívida por categoria

| Categoria | Itens | Peso |
|---|---|---|
| Configuração e ambiente | TD-01 a TD-07, TD-26 | **baixo esforço, altíssimo retorno** |
| Internacionalização | TD-10 a TD-13 | maior bloco de esforço |
| Banco e integridade | TD-11, TD-16, TD-17, TD-19 | exige backup validado antes |
| Operação | TD-14, TD-15, TD-18 | |
| Interface | TD-09, TD-20, TD-21, TD-24, TD-25 | |
| Arquitetura | TD-22, TD-23 | |

**Observação sobre a distribuição.** Os quatro itens CRITICAL e quatro dos HIGH
são **esforço P** — configuração e guardas de ambiente. A dívida que realmente
custa tempo é a de internacionalização e a de tipos de data, e nenhuma delas
bloqueia um piloto interno.
