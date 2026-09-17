# Plano de produtionização

## Onde estamos

**P1 concluída até o portão externo.** Tudo o que podia ser preparado sem
credencial sua está pronto e testado. O próximo passo exige você criar o
projeto Supabase.

### Feito nesta rodada (P1)

| Item | Classificação |
|---|---|
| Fail-fast de boot (`src/instrumentation.ts` + `startup-check.ts`) | SECURITY / OPERABILITY |
| Readiness separado do liveness (`/api/ready`) | OPERABILITY |
| Prova do banco zerado (`npm run db:proof`) | OPERABILITY |
| Shadow database configurável em `prisma.config.ts` | INFRASTRUCTURE |
| CI completo (`.github/workflows/ci.yml`) com gate de isolamento e de skips | OPERABILITY |
| 17 testes do contrato de ambiente | SECURITY |
| Nove documentos de produtionização | OPERABILITY |

Nenhuma alteração funcional do produto. Nenhuma migration. Nenhum recurso
externo criado.

## Sequência

### P2 — Fundação Supabase *(banco no ar; falta o primeiro administrador)*

| Passo | Estado |
|---|---|
| Projeto Supabase criado | ✅ `nxearovwvfotbernsrji`, região **us-west-2 (Oregon)** |
| Conexões configuradas | ✅ pooler 6543 (aplicação) e 5432 (migrations) |
| `prisma migrate deploy` | ✅ as 3 migrations aplicadas |
| Estrutura conferida | ✅ 26 tabelas · 48 foreign keys · 74 índices |
| `/api/ready` contra o Supabase | ✅ `ready`, `migrations: 3 applied` |
| Primeiro administrador real | ⬜ **pendente** — `npm run create-admin` |

**Latência medida** da máquina de desenvolvimento (Brasil) para Oregon:
**213 ms por consulta**, 1,3 s para abrir conexão. Consequências:

1. **Desenvolvimento continua no Postgres local.** Cinco consultas por tela
   contra Oregon são ~1 s só de rede. A URL local ficou guardada e comentada
   no `.env`.
2. **A aplicação tem de ser hospedada perto do banco** — região `pdx1` ou
   `sfo1` na Vercel. Com aplicação e banco juntos, a consulta volta a ~1 ms e
   o usuário brasileiro paga uma única viagem de ~170 ms por navegação, que é
   perfeitamente utilizável.
3. **Os dados ficam nos Estados Unidos.** Permitido pela LGPD com
   salvaguardas, mas é uma decisão consciente a registrar — e reversível
   enquanto o banco estiver vazio.

### P3 — Storage

Bucket privado no Supabase Storage, `STORAGE_DRIVER=s3` com o endpoint
S3-compatível. Sem mudança de código. Testar o caminho completo, incluindo as
duas tentativas que **têm** de falhar.

### P4 — Staging

Projeto/ambiente na Vercel apontando para `main`, com banco e bucket de
staging. Dados de teste que **não** sejam o seed de demonstração.

### P5 — CI em uso

Ligar o workflow (já versionado), exigir verde antes de merge, e só então
automatizar a promoção.

### P6 — Backup e restore

Definir política e **testar um restore**. É o único item desta lista que, se
faltar, não tem conserto depois.

### P7 — Produção

Com rollback ensaiado. Contas reais. Nenhuma conta semeada.

### P8 — Observabilidade

Logs agregados e alerta sobre `/api/ready` antes de haver usuário dependendo
do sistema.

### P9 — Operação contínua

Cron de prazos (hoje `TASK_DUE_SOON`/`TASK_OVERDUE` só disparam quando alguém
abre uma tela), expurgo de auditoria, e a dívida de fuso horário.

## Regra que atravessa tudo

Toda mudança daqui em diante é INFRASTRUCTURE, SECURITY, OPERABILITY, GLOBAL
READINESS ou BUG BLOCKER. Se algo exigir mudar comportamento funcional do
produto, isso **para** e vira uma conversa — não uma alteração silenciosa
depois do freeze.
