# Handoff para produtionização

Escrito para quem vai colocar a Vionex Projects em produção — provavelmente uma
pessoa que não acompanhou PC-1 a PC-6B. Descreve o que existe hoje, o que
falta, e em que ordem mexer.

O produto está funcionalmente congelado. Nada aqui foi executado: este
documento é o mapa, não o registro de uma migração.

---

## 1. Stack atual

| Camada | Escolha | Observação |
|---|---|---|
| Framework | **Next.js 16.3.4** (App Router, Turbopack) | `middleware.ts` chama-se `proxy.ts` nesta versão. `instrumentation.ts` roda uma vez antes do primeiro request — é o gancho de fail-fast. |
| Runtime | Node.js 24 | Sem código Edge. Nenhuma rota declara `runtime = "edge"`. |
| UI | React 19.2, Tailwind v4, Radix UI | Server Components por padrão; `"use client"` só onde há interação. |
| ORM | **Prisma 7.10** com driver adapter `@prisma/adapter-pg` | Cliente gerado em `src/generated/prisma` (versionado). `prisma.config.ts` carrega a datasource. |
| Banco | PostgreSQL | Em desenvolvimento: Postgres local, ou **PGlite embutido** quando `DATABASE_URL` está ausente *e* `APP_ENV` permite demonstração. |
| Auth | Sessão própria: JWT HS256 (`jose`) em cookie httpOnly | Sem NextAuth. Senhas em bcrypt, custo 12. |
| Storage | Driver próprio: `local` (padrão) ou `s3` | `src/lib/storage/` — `index.ts` escolhe, `local.ts` grava em disco, `s3.ts` fala com qualquer serviço S3-compatível. |
| Testes | Vitest (unit + integration contra Postgres real) | 93 unit, 160 integration. |

## 2. Schema e migrations

Duas migrations históricas e uma nova, todas em `prisma/migrations/`:

| Migration | Conteúdo |
|---|---|
| `20260902195200_init` | Schema inicial completo. |
| `20260909155300_login_throttle` | Tabela `LoginAttempt`. |
| `20260915111827_review_history_and_attachments` | `DocumentRequestReview`, `MessageAttachment`, FK de `DocumentRequestReply.authorId`. Puramente aditiva (PC-5). |

**Regra que a produtionização herda:** migrations são forward-only. Nenhuma das
três foi alterada depois de aplicada, e nenhuma deve ser. Uma mudança de schema
é sempre uma migration nova.

Em produção use `prisma migrate deploy` — nunca `migrate dev`, nunca
`db push`, nunca `migrate reset`.

Detalhes do modelo de dados: `docs/product-completion/13_PC5_MIGRATION.md`.

## 3. Autenticação

- Cookie `vionex_session`, httpOnly, `SameSite=Lax`, `Secure` fora de dev.
- Payload carrega **apenas** `sub` (user id) e `org`. Papel, status e vínculo
  com fornecedor são relidos do banco a cada request — uma conta rebaixada ou
  suspensa não continua agindo com um token antigo.
- Duração: 8h, ou 30 dias com "manter conectado".
- Throttle de login por e-mail e por IP (`LoginAttempt`), com resposta de tempo
  constante para e-mail inexistente.
- **Não existe autocadastro.** A primeira conta de um banco novo é criada por
  `npm run user:create -- "Nome" email ROLE`.

**Dívida:** `AUTH_SECRET` precisa ser gerado por ambiente
(`openssl rand -base64 32`) e rotacionado com plano — hoje a rotação invalida
todas as sessões de uma vez.

## 4. Storage atual

`STORAGE_DRIVER=local` grava em `STORAGE_LOCAL_DIR` (padrão `./storage`).
Serve para desenvolvimento e **não sobrevive a um deploy serverless**: o disco
é efêmero e não é compartilhado entre instâncias.

O driver `s3` já existe e fala com qualquer serviço S3-compatível
(`STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`,
`STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_FORCE_PATH_STYLE`). Trocar de
driver é configuração, não código.

**Invariante que não pode ser quebrada na migração:** todo download passa por
`/api/files/[versionId]`, que revalida a sessão, reaplica o escopo e registra
auditoria. Não existe URL pública, URL assinada de longa duração, nem bypass
por id de anexo. Se o bucket for público, o isolamento entre fornecedores
deixa de existir — o banco continuaria correto e os arquivos, não.

## 5. Ambientes

`APP_ENV` (`development | test | demo | preview | staging | production`) é
distinto de `NODE_ENV`. Precedência: `APP_ENV` explícito → `VERCEL_ENV` →
`NODE_ENV` → `development`. **Nada na cadeia produz `demo`** — demonstração é
declarada, nunca inferida.

Consequências já implementadas:

- Em ambiente real, `DATABASE_URL` ausente é **erro**, não convite para o banco
  embutido com senhas publicadas.
- O snapshot de demonstração não é gerado em build de ambiente real; o módulo
  é escrito vazio para o import resolver, e quem tentar carregá-lo recebe erro.
- `/demo/enter` (login sem senha das contas semeadas) responde 404 fora de
  desenvolvimento/demo.

## 6. Blockers conhecidos de produção

Nenhum é blocker **funcional** — todos pertencem a esta fase.

1. **Banco gerenciado não existe.** Supabase/Neon/RDS a escolher, provisionar,
   e `migrate deploy` contra ele.
2. **Storage de produção não existe.** Bucket S3-compatível, credenciais, CORS,
   política privada.
3. **Segredos.** `AUTH_SECRET`, `DATABASE_URL`, credenciais de storage por
   ambiente. Hoje só existe `.env` local (não versionado).
4. **Contas reais.** O seed de demonstração cria contas com senha publicada
   (`vionex123`). Elas **não podem** existir em produção.
5. **CI.** Não há pipeline. `npm run lint && typecheck && test && build` roda só
   localmente. Os testes de integração exigem um Postgres real.
6. **Backups.** Nenhuma política de backup, restore ou PITR.
7. **`TASK_DUE_SOON` / `TASK_OVERDUE` dependem de alguém abrir a tela.** Não há
   scheduler; as notificações de prazo são emitidas quando o código roda por
   causa de uma visita. Um cron é necessário para que um prazo vencido avise
   sem que ninguém entre.

## 7. Dívida de global readiness

O produto já é trilíngue na interface (pt-BR, en, zh) e escolhe o idioma pela
preferência do usuário. O que falta:

- **Fuso horário.** `formatDate` renderiza em UTC de propósito (prazo é data,
  não instante) e `daysUntil` foi alinhado a isso em PC-6B. Mas
  `formatDateTime` — mensagens, uploads, timestamps de análise — usa o fuso do
  **servidor**. Um fornecedor em Shenzhen vê horários de São Paulo. Corrigir
  exige decidir entre renderizar no cliente ou guardar o fuso do usuário.
- **Tradução incompleta.** O portal está traduzido; o ambiente interno é
  pt-BR por decisão de produto. Strings novas de PC-6A/6B no portal estão no
  dicionário; as do ambiente interno estão em português no código.
- **China.** Nenhuma validação de acesso a partir da China (latência, DNS,
  bloqueios). O produto não depende de Google Fonts nem de CDNs bloqueadas,
  o que ajuda, mas isso não é uma validação.
- **Residência de dados.** Não avaliada.

## 8. Dívida de segurança

- **Sem MFA e sem SSO.** Decisão consciente: não simular na interface.
- **Sem rate limit global** — só o throttle de login. Uploads e ações não têm
  limite por usuário.
- **Auditoria existe, expurgo não.** `AuditLog` cresce sem política de
  retenção.
- **CSP já é restritiva** (`default-src 'self'`), mas ainda contém
  `'unsafe-inline'` e `'unsafe-eval'` em `script-src` por causa do dev
  overlay — revisar para produção.
- **Sem varredura de antivírus em upload.** O tipo é validado por MIME ×
  extensão × tamanho, o que não é o mesmo que o arquivo ser seguro.

## 9. Dívida de observabilidade

Não existe: sem APM, sem tracing, sem agregação de logs, sem alerta. O que
existe é `/api/health`, que responde `{status, database, storage, latencyMs}` —
suficiente para um readiness probe e nada além disso. Erros vão para o
`console` do servidor.

## 10. Segurança dos dados

O que o produto já garante, e que a produtionização não pode perder:

- **Isolamento por fornecedor aplicado no servidor**, dentro da query, nunca
  escondendo elemento na interface. Oito funções de escopo puro em
  `src/server/authz/scopes.ts`, sete guardas em `access.ts`.
- **Capacidade verificada no serviço**, não só na action (PC-6B).
- **Nenhum delete destrutivo no produto**: projeto arquiva, usuário suspende.
  Seis foreign keys `Restrict` impedem apagar quem produziu trabalho, para que
  a autoria do histórico continue verdadeira.
- **Versões de documento nunca são substituídas**, só acrescentadas.
- **Histórico de análise é imutável** e não foi retroativamente fabricado.

## 11. Migração para Supabase — o que considerar

1. **Pooling.** Supabase expõe conexão direta (5432) e pooler (6543, PgBouncer
   em transaction mode). `migrate deploy` precisa da **direta** (`DIRECT_URL`,
   já previsto no schema); a aplicação usa a **pooled**. Prepared statements
   não sobrevivem ao transaction pooling — o adapter `pg` já é compatível, mas
   confira `?pgbouncer=true` na URL quando aplicável.
2. **Row Level Security.** Supabase liga RLS por padrão em tabelas criadas pelo
   painel. As tabelas aqui vêm de migrations Prisma e a autorização é feita na
   aplicação. **Não habilite RLS pela metade**: ou fica desligada (e a
   aplicação continua sendo a fronteira), ou é escrita por completo. Uma RLS
   parcial dá falsa sensação de defesa em profundidade.
3. **Não use Supabase Auth.** O produto tem sessão própria; misturar dois
   sistemas de identidade é como um fornecedor acaba vendo o projeto de outro.
4. **Não use Supabase Storage sem adaptar o driver.** O driver `s3` funciona
   com o endpoint S3-compatível do Supabase Storage; o SDK `supabase-js` não é
   necessário e não deve ser introduzido.
5. **Região.** Escolher pensando em latência para China, Alemanha, EUA e
   Itália, não só para o Brasil.

## 12. Migração de storage — o que considerar

1. Criar o bucket **privado**. Sem exceção: o controle de acesso é a rota
   autenticada.
2. Definir `STORAGE_DRIVER=s3` e as credenciais; nada no código muda.
3. **Migrar os arquivos existentes** de `./storage` preservando a `storageKey`
   de cada `DocumentVersion` — a chave é a ligação entre a linha e o objeto.
   Copie primeiro, verifique, só então desligue o driver local.
4. Verificar limite de tamanho de request da plataforma contra
   `UPLOAD_MAX_SIZE_MB` (padrão 25).
5. Testar o caminho completo depois: upload → download por
   `/api/files/[versionId]` → tentativa de download pelo fornecedor errado
   (tem de falhar) → tentativa de acesso direto ao objeto (tem de falhar).

## 13. Ordem recomendada

1. **Segredos e ambientes** — `APP_ENV`, `AUTH_SECRET` por ambiente.
2. **Banco gerenciado** — provisionar, `migrate deploy`, verificar as três
   migrations aplicadas na ordem.
3. **Storage** — bucket privado, driver `s3`, migrar arquivos, testar o
   caminho autenticado.
4. **Staging** — ambiente completo, com dados de teste que **não** sejam o seed
   de demonstração.
5. **Contas reais** — criar os usuários da Vionex; remover/bloquear qualquer
   conta semeada; trocar senhas provisórias no primeiro acesso.
6. **CI** — lint, typecheck, unit, integration (com Postgres de serviço),
   build. Só então deploy automático.
7. **Observabilidade** — logs agregados e alerta em cima de `/api/health`
   antes de haver usuário real dependendo do sistema.
8. **Backup e restore** — e um **restore testado**, não só configurado.
9. **Produção** — com rollback ensaiado.
10. **Scheduler** — cron de prazos (o item 7 da seção 6).
11. **Global readiness** — fuso horário, validação a partir da China.

Uma frase para quem executar: os itens 1 a 3 são pré-requisito de tudo; o 8
parece adiável e é o único que, quando falta, não tem conserto depois.
