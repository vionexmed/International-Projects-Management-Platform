# 26 — Plano mestre de implementação (revisão 2)

> **Nada aqui foi executado.** Revisão 2 incorpora as decisões de 15/09/2026:
> divisão da Fase A em A0/A1/A2, `APP_ENV` explícito, fail-fast em ambientes
> reais, demo explícito, e separação entre liveness e readiness.
>
> Revisão 1 (14/09) mantida no histórico do git.

## Princípio de ordenação

Preservação de dados antes de tudo. Nenhuma fase que toque migrations começa
antes de a Fase B estar concluída **e o restore testado de verdade**.

Segundo princípio, novo nesta revisão: **preparação de segurança, mecanismo de
deploy e toque em banco persistente nunca acontecem na mesma rodada.**

---

# ⚠ Quatro problemas técnicos nas decisões — leia antes de aprovar

O item 12 do pedido manda avisar quando uma decisão cria problema técnico. Quatro
criam. Três têm solução dentro da própria subfase; um muda o escopo de A1.

## C-1 · O snapshot de demonstração quebra o `typecheck` — **VERIFICADO**

Isto afeta duas decisões ao mesmo tempo: "instalar o CI" (GOV-001) e "snapshot de
demonstração proibido em produção".

**O que verifiquei.** Extraí um checkout limpo (`git archive HEAD`, só arquivos
versionados), liguei o cliente Prisma já gerado — exatamente o estado após
`npm ci` — e rodei `npx tsc --noEmit`. Resultado: **um único erro.**

```
src/server/demo/embedded-db.ts(36,49): error TS2307:
  Cannot find module '@/server/demo/snapshot/data' or its corresponding type declarations.
```

**Por quê.** `src/server/demo/snapshot/` é gitignored. O arquivo só nasce quando
`npm run demo:snapshot` roda, e isso só acontece dentro do script `build`. Mas a
ordem do `ci/github-ci.yml` é:

```
Install → Apply migrations → Lint → Typecheck → Test → Build
                                        ↑
                          o snapshot ainda não existe aqui
```

**Consequência imediata:** o CI, como está escrito hoje, **falharia no passo
Typecheck**. GOV-001 não é mover um arquivo de pasta — é mover **depois** de
resolver isto. Ninguém percebeu porque o CI nunca rodou.

**Consequência para a decisão 3/5:** tornar `demo:snapshot` condicional a
`APP_ENV` faz o snapshot não existir no build de produção — e reintroduz
exatamente este erro, agora no `next build`.

**Solução proposta.** Desacoplar o snapshot do grafo de tipos: versionar
`src/server/demo/snapshot/data.ts` como um **stub** que exporta
`DEMO_SNAPSHOT_BASE64 = ""`, e fazer o gerador sobrescrevê-lo. `embedded-db.ts`
passa a checar a string vazia e falhar com mensagem clara
("snapshot não gerado — rode `npm run demo:snapshot`"). Ganhos:
`typecheck` verde em qualquer checkout, `demo:snapshot` pode ser condicional, e o
`.gitignore` passa a ignorar só o conteúdo gerado, não o módulo.

**Alternativa** (mais limpa, mais trabalho): tirar o snapshot do grafo de módulos
e carregá-lo como arquivo de dados em runtime. Perde a garantia de empacotamento
em serverless que motivou o base64. Não recomendo agora.

## C-2 · Fail-fast **não pode** ser no import — senão o build quebra

`src/lib/env.ts` valida no **primeiro acesso**, não no import, e o comentário
explica por quê: `next build` avalia os módulos de rota para coletar configuração,
e esses módulos importam `env`. Validar no import reprovaria o build de um projeto
correto só porque as variáveis do deploy ainda não estão presentes.

Este projeto **já se queimou com essa classe de problema duas vezes** — a guarda
que exigia S3 bloqueava páginas sem relação com documentos, e a que exigia
`APP_URL` https bloqueava o boot inteiro. Repetir seria o terceiro.

**Onde o fail-fast deve morar:** `src/instrumentation.ts`, hook `register()`. A
documentação do Next 16 instalada em
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`
diz textualmente:

> *"the `register` function … is called **once** when a new Next.js server
> instance is initiated, and must complete before the server is ready to handle
> requests."*

É exatamente o contrato de "recusar inicialização". O arquivo **não existe hoje**
— A1 o cria. Bônus: o mesmo arquivo exporta `onRequestError`, que é o gancho
natural para OPS-001 na Fase J.

## C-3 · `APP_ENV` ausente derruba todo preview da Vercel

A Vercel define `NODE_ENV=production` também em preview. Se `APP_ENV` for
obrigatório e não estiver definido, **o primeiro deploy após A1 falha** — e todo
preview junto.

**Solução:** precedência explícita e documentada, com derivação segura:

```
APP_ENV explícito                    → usa
senão, VERCEL_ENV=production         → "production"
senão, VERCEL_ENV=preview            → "preview"
senão, NODE_ENV=test                 → "test"
senão                                → "development"
```

Nunca deriva para `demo`. `demo` só existe quando escrito à mão.

**E uma decisão de sequenciamento:** a variável precisa ser criada no painel da
Vercel **antes** do merge de A1, não depois. Caso contrário o deploy que introduz
a guarda é o mesmo que a viola.

## C-4 · CI sem portão de deploy é decorativo — **lacuna na decisão 9**

A decisão 9 diz que o CI valida e o deploy é responsabilidade separada. Concordo.
Mas hoje **o deploy já é automático**: push em `main` → Vercel publica. Instalar o
CI não impede nada, porque o deploy não espera por ele.

O CI só vira portão se **também** houver:
1. `main` protegida, exigindo PR e CI verde para merge; e
2. uma decisão explícita sobre o deploy automático que já existe.

**Proposta de menor risco:** como hoje não há ambiente com dado real, o deploy
automático a partir de `main` continua — mas passa a apontar apenas para o
endereço de **demonstração**, com `APP_ENV=demo`. Nenhum projeto de produção é
criado em A1. Assim o blast radius de A1 é zero e o CI passa a valer de verdade
para o que vier depois.

Isto precisa da sua decisão — está em [38_UNRESOLVED_QUESTIONS.md](38_UNRESOLVED_QUESTIONS.md).

---

# A0 — Baseline / Freeze

**Objetivo:** registrar o estado conhecido antes da primeira alteração, para que
qualquer regressão futura tenha um ponto de comparação.

**Findings tratados:** nenhum. A0 não corrige nada de propósito.

**Impacto no banco:** **nenhum.** **Migration:** não. **Toca produção:** não.
**Altera comportamento:** não.

**Arquivos criados:** apenas documentação — `docs/audit/41_BASELINE.md` e
`docs/audit/baseline/` para os artefatos.

**O que registrar:**

| Item | Como capturar |
|---|---|
| Commit e árvore | `git rev-parse HEAD`, `git status --porcelain`, `git log -1` |
| Versões | `node -v`, `npm -v`, versões de `next`, `react`, `prisma`, `typescript` |
| Lockfile | `sha256` de `package-lock.json` |
| Schema | `sha256` de `prisma/schema.prisma` |
| Migrations | lista ordenada + `sha256` de cada `migration.sql` + `migration_lock.toml` |
| Schema SQL derivado | `sha256` de `src/server/demo/schema-sql.ts` (para detectar a dessincronização de DB-029) |
| **Testes — com banco de pé** | saída completa de `npm test`, nomeando arquivos que executaram |
| **Testes — com banco parado** | a mesma saída; é o estado que expõe TEST-001 |
| Skips | lista nominal de cada teste pulado nos dois cenários |
| Banco dos testes | valor de `DATABASE_URL` **mascarado** (host/porta/base, nunca credencial) |
| Storage dos testes | valor de `STORAGE_LOCAL_DIR` resolvido |
| Inventário de ambiente | **nomes** das variáveis presentes, nunca valores |
| Superfície de rotas | lista de rotas do `next build` da revisão 1 |
| Dependências | `npm audit --json` e `npm outdated --json` |

**Regra de conteúdo:** nenhum valor de segredo entra no baseline. Só nomes,
hashes e contagens — a mesma regra que `environmentIssues()` já segue.

**Riscos:** praticamente nenhum. O único é registrar segredo por descuido — daí a
regra acima.

**Testes necessários:** nenhum novo. A0 *consome* a saída dos testes atuais.

**Rollback:** apagar os arquivos criados.

**Critério de aceite:** um documento que permita, daqui a três meses, responder
"o que mudou desde o início" sem depender de memória. E que registre, com número,
os dois resultados de teste — com banco e sem.

---

# A1 — Production Safety Guards

**Objetivo:** eliminar fallbacks perigosos e credenciais conhecidas **antes** de
a aplicação chegar perto de produção. A1 **não toca banco persistente** e **não
faz deploy**.

## Findings tratados

| ID | O que muda |
|---|---|
| **SEC-001** | `/demo/enter` e `/demo` deixam de existir fora de `development`/`test`/`demo` |
| **SEC-002** | seed remoto com senha aleatória; snapshot com credencial conhecida proibido fora de demo |
| **SEC-003** | `AUTH_SECRET` obrigatório em `staging`/`production`; `DEMO_SIGNING_KEY` recusado |
| **DB-007** | banco embutido proibido em `staging`/`production`; ausência de `DATABASE_URL` recusa a inicialização |
| **STO-003** | `STORAGE_DRIVER=local` proibido em `staging`/`production`; storage persistente ausente recusa a inicialização |
| **TEST-001** | suíte falha em aberto → falha fechada; suítes críticas com execução obrigatória |
| **GOV-001** | CI instalado e verde — **depois de C-1 resolvido** |
| **C-1** (novo) | snapshot desacoplado do grafo de tipos |
| **C-2** (novo) | `instrumentation.ts` criado como ponto de fail-fast |
| **C-3** (novo) | `APP_ENV` com precedência documentada |
| **PERF-004** | `demo:snapshot` deixa de rodar em build que não é de demonstração |

**Fora do escopo, por decisão explícita:** convite de usuário, definição inicial
de senha, recuperação de senha, MFA e revogação global de sessão — tudo isso
permanece na **Fase C**.

## `APP_ENV` — o contrato

```
APP_ENV ∈ { development, test, demo, preview, staging, production }
```

`NODE_ENV` continua sendo o que sempre foi: sinal de build do Node e do Next
(`development` | `test` | `production`). **`APP_ENV` responde a outra pergunta:
que ambiente operacional é este?** As duas coexistem e têm responsabilidades
distintas.

### Matriz de capacidades

| Capacidade | development | test | demo | preview | staging | production |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Banco embutido (PGlite) | ✔ | ✔ | ✔ | ✖ | **✖** | **✖** |
| `STORAGE_DRIVER=local` | ✔ | ✔ | ✔ | ✖ | **✖** | **✖** |
| Autenticação de demonstração (`/demo`) | ✔ | ✔ | ✔ | **✖** | **✖** | **✖** |
| Snapshot de demonstração | ✔ | ✔ | ✔ | ✖ | **✖** | **✖** |
| Credenciais conhecidas | ✔ | ✔ | ✔ | ✖ | **✖** | **✖** |
| `AUTH_SECRET` = `DEMO_SIGNING_KEY` | ✔ | ✔ | ✔ | ✖ | **✖** | **✖** |
| `DATABASE_URL` obrigatória | ✖ | ✔ | ✖ | ✔ | **✔** | **✔** |
| Storage persistente obrigatório | ✖ | ✖ | ✖ | ✔ | **✔** | **✔** |

`preview` é **proibido por padrão** para tudo que é demo, conforme a decisão 4.

### A regra que fecha o buraco central

> **Modo demo nunca é inferido. É declarado.**

`isDemoEnabled()` deixa de ser `return true` e passa a ser
`APP_ENV ∈ {development, test, demo}` — **e nada mais**. Ausência de
`DATABASE_URL`, de `AUTH_SECRET` ou de storage **nunca** liga o modo demo; liga o
fail-fast.

Mesma regra para `shouldUseEmbeddedDatabase()`: hoje ela decide pela ausência da
variável. Passa a exigir que o ambiente **permita** banco embutido **e** que a
variável esteja ausente. Em `staging`/`production`, ausência é erro, não escolha.

## Fail-fast — onde e como

Em `src/instrumentation.ts`, `register()` (ver C-2). Verifica, quando
`APP_ENV ∈ {preview, staging, production}`:

1. `APP_ENV` é um valor conhecido;
2. `DATABASE_URL` presente e não-vazia, e **não** aponta para o embutido;
3. `AUTH_SECRET` presente, com 32+ caracteres, e **diferente** de `DEMO_SIGNING_KEY`;
4. `STORAGE_DRIVER` ≠ `local`, com credenciais e bucket presentes;
5. `isDemoEnabled()` é falso;
6. o snapshot de demonstração não está carregado.

Falhando qualquer uma: lança com mensagem que **nomeia a variável** e nunca
imprime valor. O processo não fica pronto para receber tráfego.

**Por que não no `env.ts`:** ver C-2. `env.ts` permanece preguiçoso, de propósito.

## Liveness × Readiness

O `/api/health` atual mistura três coisas e é público e descritivo (SEC-009).
A1 separa:

| | `/api/health/live` | `/api/health/ready` |
|---|---|---|
| Pergunta | o processo está vivo? | esta instância pode receber tráfego? |
| Verifica | só que o handler executa | ambiente, banco, storage, migrations, demo desligado, segredo seguro |
| Custo | zero — nenhum I/O | consulta banco e storage |
| Resposta a anônimo | `200` / `503`, **corpo sem detalhe** | `200` / `503`, **corpo sem detalhe** |
| Detalhe | — | só com token de operação ou origem interna |

**Divisão dos checks:**

| Check | Liveness | Readiness | Por quê |
|---|:---:|:---:|---|
| handler executa | ✔ | — | é a definição de vivo |
| `APP_ENV` válido | — | ✔ | erra o ambiente, erra tudo |
| banco alcançável | — | ✔ | I/O não pertence a liveness |
| banco **não** é embutido | — | ✔ | é o furo do DB-007 |
| schema compatível com o código | — | ✔ | pega GOV-002 antes do usuário |
| storage persistente e acessível | — | ✔ | hoje nada detecta |
| modo demo desligado | — | ✔ | a condição mais perigosa, hoje ausente do health |
| `AUTH_SECRET` não é o publicado | — | ✔ | idem |

**Correção de contrato:** o health atual devolve a um anônimo, nos `warnings`,
que as sessões são assinadas com chave publicada. Isso acaba. O detalhe passa a
exigir autenticação de operação.

**Nota de projeto:** com o fail-fast de C-2, uma instância mal configurada nem
chega a responder — o readiness cobre o que muda **depois** do boot (banco caiu,
bucket revogado, schema divergiu). Os dois são complementares, não redundantes.

## TEST-001 — fail closed sem quebrar o melhor teste

**Cuidado necessário:** `tests/unit/scopes.test.ts` é o melhor teste do
repositório **e roda sem banco**. Exigir banco para tudo tornaria mais difícil
rodar justamente o que mais importa. Por isso, dois comandos:

| Comando | Exige infraestrutura? | Comportamento sem ela |
|---|---|---|
| `npm run test:unit` | **não** | roda e passa |
| `npm run test:integration` | **sim** | **falha, alto e claro** — nunca pula |
| `npm test` | encadeia os dois | falha se o segundo não puder rodar |

`tests/setup.ts` passa a verificar **alcançabilidade** (um `SELECT 1` com
timeout), não a mera presença da string.

### Contrato do CI — por invariante, não por contagem

A decisão 8 está certa: contagem fixa envelhece. O contrato é:

```
failed                     = 0
unexpected skipped         = 0
suítes críticas executadas = todas
```

**Suítes críticas** (a lista vive em arquivo versionado, revisado por PR):

- `tests/unit/scopes.test.ts`
- `tests/unit/permissions.test.ts`
- `tests/integration/supplier-isolation.test.ts`
- `tests/integration/workflows.test.ts`
- `tests/integration/auth.test.ts`
- `tests/integration/throttle.test.ts`

**Como implementar "0 unexpected skipped":** o Vitest não distingue skip
esperado de inesperado. Proposta: reporter JSON + um script de asserção que
(a) falha se houver qualquer `skipped` fora de uma allowlist nominal, e (b) falha
se qualquer suíte crítica tiver executado **zero** asserções. Sem isso, "0
skipped" é uma intenção sem mecanismo.

**Skips legítimos** (allowlist inicial): nenhum hoje. Cada skip futuro entra por
PR, com justificativa no próprio arquivo. **Skips proibidos:** qualquer um em
suíte crítica; qualquer um causado por indisponibilidade de infraestrutura.

## Arquivos previstos

| Arquivo | Natureza |
|---|---|
| `src/lib/env-schema.ts` | acrescenta `APP_ENV`, precedência e as regras da matriz |
| `src/lib/app-env.ts` | **novo** — precedência, tipo e predicados (`isRealEnvironment()`, `allowsDemo()`) |
| `src/instrumentation.ts` | **novo** — fail-fast em `register()` |
| `src/lib/demo.ts` | `isDemoEnabled()` passa a depender de `APP_ENV` |
| `src/server/demo/embedded-db.ts` | `shouldUseEmbeddedDatabase()` exige ambiente permissivo; trata stub vazio |
| `src/server/demo/snapshot/data.ts` | **novo, versionado** — stub (C-1) |
| `.gitignore` | deixa de ignorar o módulo; ignora só o conteúdo gerado |
| `src/lib/storage/index.ts` | recusa `local` em ambiente real |
| `src/app/api/health/route.ts` | dividido em `live` e `ready` |
| `src/app/api/health/live/route.ts` | **novo** |
| `src/app/api/health/ready/route.ts` | **novo** |
| `src/app/demo/**` | 404 fora de ambiente permissivo |
| `src/app/page.tsx` | raiz deixa de mandar anônimo para `/demo` em ambiente real |
| `package.json` | `test:unit`, `test:integration`; `demo:snapshot` condicional |
| `scripts/build-demo-snapshot.mjs` | sai silenciosamente fora de demo |
| `scripts/assert-test-contract.mjs` | **novo** — invariantes do CI |
| `tests/setup.ts` | verifica alcançabilidade |
| `tests/unit/demo-mode.test.ts` | **invertido** — hoje fixa o comportamento inseguro |
| `tests/unit/app-env.test.ts` | **novo** — a matriz inteira |
| `tests/unit/fail-fast.test.ts` | **novo** |
| `.github/workflows/ci.yml` | **novo** — origem em `ci/github-ci.yml`, com typecheck corrigido |
| `prisma/seed.ts` | senha aleatória fora de ambiente permissivo |
| `.env.example` | documenta `APP_ENV`; corrige as três afirmações desatualizadas |

**Nenhum arquivo de `src/server/authz/`, `src/server/services/` ou
`prisma/schema.prisma` é tocado.**

## Impacto no banco: **nenhum**

Sem migration, sem alteração de schema, sem escrita em banco persistente. A única
interação nova é um `SELECT 1` com timeout, na inicialização e no readiness.

## Dependências

**Depende de:** A0 concluída.
**Não depende de:** B. **Pode correr em paralelo com B.**
**Pré-condição externa:** `APP_ENV` criada no painel da Vercel **antes** do merge
(C-3), e a decisão sobre o deploy automático (C-4).

## Riscos

| Risco | Mitigação |
|---|---|
| Guarda estrita demais derruba a aplicação inteira por uma funcionalidade — **já aconteceu duas vezes neste projeto** | fail-fast só em `preview`/`staging`/`production`; mensagem nomeando a variável; `development`/`demo` intocados |
| `APP_ENV` esquecida derruba todo preview | precedência com derivação de `VERCEL_ENV` (C-3); variável criada antes do merge |
| Fail-fast no import quebra o build | fail-fast em `instrumentation.ts`, nunca no import (C-2) |
| CI falha no typecheck logo ao ser instalado | C-1 resolvido **antes** de mover o arquivo |
| Tornar unit tests dependentes de banco | `test:unit` explicitamente sem infraestrutura |
| Fechar `/demo` derruba a demonstração que o superior avalia | o endereço de demonstração roda com `APP_ENV=demo` e **continua funcionando igual** |

## Testes necessários

| Teste | Verifica |
|---|---|
| `app-env.test.ts` | a matriz inteira, célula por célula |
| `fail-fast.test.ts` | cada uma das 6 condições recusa o boot em ambiente real, e **não** recusa em `development`/`demo` |
| `demo-mode.test.ts` (invertido) | `isDemoEnabled()` falso em `preview`/`staging`/`production` |
| novo, em `route-structure` | `/demo` e `/demo/enter` retornam 404 em ambiente real |
| `storage` | `local` recusado em ambiente real, aceito em `development` |
| `assert-test-contract` | falha quando uma suíte crítica não executa |
| `typecheck` em checkout limpo | verifica C-1 — é o teste que hoje falharia |

## Rollback

Reverter o commit. Nenhuma escrita persistente, nenhuma migration, nenhum dado
tocado. **A1 é totalmente reversível.**

Único efeito colateral a lembrar: se `APP_ENV` já tiver sido criada no painel,
ela fica — inofensiva, porque o código revertido a ignora.

## Critérios de aceite

- [ ] Com `APP_ENV=production` e sem `DATABASE_URL`, a aplicação **recusa a inicialização** com mensagem nomeando a variável
- [ ] Idem sem `AUTH_SECRET`, com `AUTH_SECRET=DEMO_SIGNING_KEY`, e com `STORAGE_DRIVER=local`
- [ ] Com `APP_ENV=production`, `/demo` e `/demo/enter` retornam **404**
- [ ] Com `APP_ENV=demo`, tudo continua funcionando exatamente como hoje
- [ ] `npm run typecheck` passa **num checkout limpo**, sem build prévio
- [ ] `npm run test:unit` passa sem nenhuma infraestrutura
- [ ] `npm run test:integration` **falha** claramente com o banco parado
- [ ] `npm test` com banco parado termina em **falha**, nunca em verde
- [ ] CI instalado e verde, com o contrato por invariante
- [ ] `/api/health/live` e `/api/health/ready` respondem; **nenhum** devolve detalhe a anônimo
- [ ] `git diff` não toca `src/server/authz/`, `src/server/services/` nem `prisma/`

---

# A2 — Deployment Foundation

**Objetivo:** construir o mecanismo de promoção entre ambientes, validado
primeiro em staging.

## Findings tratados

| ID | O que muda |
|---|---|
| **GOV-002** | `prisma migrate deploy` no pipeline — **primeiro em staging** |
| **GOV-003** | `main` protegida, PR obrigatório, preview por PR |
| **GOV-004** | configuração de deploy versionada (`vercel.json`) |
| **ENV-002** | staging passa a existir, com banco, storage e secrets próprios |
| resto de **SEC-009** | readiness com detalhe autenticado |

## Impacto no banco

**Aqui sim.** A2 executa migrations contra banco persistente — por isso depende
da Fase B.

**Regra dura:** A2 só toca **staging** enquanto B não estiver concluída com
restore validado. Produção só depois.

## Dependências

**Depende de:** A1 concluída **e** B concluída com **restore real executado**.
Esta é a barreira mais importante do plano inteiro.

## Riscos

| Risco | Mitigação |
|---|---|
| Migration automática contra banco com dado real | só staging até B validada; gate manual para produção |
| Promoção acidental para produção | ambientes separados no painel, aprovação manual explícita |
| Rollback de código incompatível com schema | expand/contract obrigatório ([28](28_ROLLBACK_PLAN.md)) |
| Readiness aprovando instância com schema divergente | o check de compatibilidade de migrations entra aqui |

## Testes necessários

Ensaio completo em staging: aplicar uma migration aditiva, promover, verificar
readiness, **executar um rollback de verdade** e registrar o tempo.

## Rollback

Promover o deploy anterior — **promover, não redeployar** (o botão de Redeploy
reutiliza o mesmo commit; este projeto já tropeçou nisso). Para o banco, ver
[28](28_ROLLBACK_PLAN.md).

## Critérios de aceite

- [ ] Staging existe, com banco, storage e secrets próprios, sem compartilhar nada
- [ ] `prisma migrate deploy` roda no pipeline de staging, antes de o código receber tráfego
- [ ] Produção exige aprovação manual
- [ ] `main` protegida; nenhum push direto
- [ ] Preview por PR funcionando, com `APP_ENV=preview` e demo proibido
- [ ] `vercel.json` versionado
- [ ] **Um rollback exercitado em staging, cronometrado e documentado**

---

# Fase B — Data Safety (inalterada, e agora paralela a A1)

**Escopo:** Postgres gerenciado, região, backup, retenção, criptografia, RPO,
RTO, **restore real em ambiente isolado**, documentação.

**Impacto no banco:** cria o banco. Não altera nenhum existente — não há nenhum.

**Depende de:** nada. **Pode correr em paralelo com A1**, precisamente porque A1
não toca banco persistente.

**Bloqueia:** A2 e a Fase E.

**Critério de aceite:** um restore **executado**, cronometrado e documentado, com
RPO e RTO medidos. Detalhes em [16](16_BACKUP_AND_RESTORE.md).

> **Backup configurado sem restore testado não conta como concluído.**

---

# Fases C a P — revisão de validade

Resposta ao item 13: **as fases seguem válidas**, com quatro ajustes de escopo.

| Fase | Situação | Ajuste |
|---|---|---|
| **C** — Auth/Authz | **válida, e ampliada** | Recebe o que A1 explicitamente não faz: convite, senha inicial, recuperação, MFA, revogação global. Mais SEC-005, SEC-008, AUTH-001 |
| **D** — Multitenancy | **válida** | TEN-002 e ARCH-001. **TEST-001 sai daqui** — foi para A1 |
| **E** — Integridade do banco | **válida** | **Rodada isolada.** Primeira fase com migrations em banco persistente |
| **F** — Arquitetura backend | válida | sem mudança |
| **G** — Endurecimento | válida | SEC-009 perde a parte de health, que foi para A1 |
| **H** — Storage | **válida, reduzida** | STO-003 saiu para A1. Restam STO-001, 002, 004, 005 |
| **I** — Global | **válida** | depende de E para as migrations de `DATE`/`timestamptz` |
| **J** — Observabilidade | **válida** | ganha `onRequestError`, que A1 deixa disponível em `instrumentation.ts` |
| **K** — CI/CD | **absorvida** | A1 e A2 tomaram o essencial. K vira **maturidade**: canary, feature flags, rollout por fornecedor |
| **L** — UI/UX | **válida, com UX-001 promovido** | ver abaixo |
| **M** — Performance | válida | depende de E para índices |
| **N** — Staging | **absorvida por A2** | deixa de ser fase própria |
| **O** — Piloto interno | **válida, com portão novo** | ver abaixo |
| **P** — Rollout | válida | ver [27](27_GO_LIVE_CHECKLIST.md) |

## UX-001 — portão duro antes de qualquer fornecedor externo

> **NENHUM PILOTO COM FORNECEDOR EXTERNO antes de UX-001 estar resolvido e
> testado.**

O formulário não pode apagar o que o fornecedor digitou quando a ação falha. Para
quem está numa conexão instável do outro lado do mundo, perder a nota e o arquivo
selecionado no mesmo instante em que lê uma mensagem de erro é o suficiente para
abandonar a plataforma.

UX-001 **não** entra em A1, conforme decidido. Mas:
- não toca banco, não toca deploy → **pode ser executado a qualquer momento**;
- recomendo antecipá-lo para a Rodada 2, junto de UX-002 e UX-003, que são o
  mesmo fluxo;
- o portão fica registrado em [27](27_GO_LIVE_CHECKLIST.md) e na Fase O.

---

# Grafo de dependências

```
A0 ──► A1 ──────────────────────────────┐
  │      │                              │
  │      ├─► C ──► D ─────────┐         │
  │      │                    │         │
  │      ├─► F                │         │
  │      ├─► G                │         │
  │      ├─► H (parcial)      │         │
  │      ├─► J                │         │
  │      └─► L (inclui UX-001)│         │
  │                           │         │
  └──► B ─────┬──► A2 ────────┤         │
              │    (staging)  │         │
              │               │         │
              └──► E ──┬──► I │         │
                       │      │         │
                       └──► M │         │
                              ▼         ▼
                         O (piloto interno)
                              │
                    ┌─────────┴─────────┐
                    │  portão UX-001    │
                    └─────────┬─────────┘
                              ▼
                         P (rollout)
```

## Barreiras que não podem ser puladas

| # | Barreira | Razão |
|---|---|---|
| 1 | **A0 antes de A1** | sem baseline não há como provar o que mudou |
| 2 | **B + restore validado antes de A2** | A2 aponta migrations para banco persistente |
| 3 | **B + restore validado antes de E** | E converte tipos de coluna; perda de precisão é irreversível |
| 4 | **A1 antes de qualquer ambiente real** | é o que impede fallback silencioso |
| 5 | **TEST-001 (A1) antes de D** | sem suíte que execute, D não tem como ser provada |
| 6 | **UX-001 antes de fornecedor externo** | decisão 13 |
| 7 | **E antes de I** | I depende das migrations de data |
| 8 | **C antes de D** | mapear papéis antes de estreitar escopos |

## Paralelismos reais

| Podem correr juntas | Por quê |
|---|---|
| **A1 ∥ B** | A1 não toca banco persistente; B não toca código |
| **C ∥ F ∥ G ∥ J ∥ L** | domínios disjuntos, nenhuma toca migration |
| **I ∥ M** | ambas dependem de E, nenhuma depende da outra |
| **H ∥ qualquer coisa** | storage é isolado |

---

# Rodadas

Agrupamento por **blast radius**, não por ordem alfabética.

## Rodada 1 — `A0 → A1 ∥ B`

**Blast radius:** zero em dados. A1 é totalmente reversível; B só cria
infraestrutura nova.
**Entrega:** os três caminhos de comprometimento total fechados, fallback
silencioso eliminado, CI valendo, backup com restore provado.
**Muda o veredito:** NO-GO → **CONDITIONAL GO** para piloto interno.
**Pré-condições:** `APP_ENV` criada no painel (C-3); decisão sobre deploy
automático (C-4); C-1 resolvido antes de instalar o CI.

## Rodada 2 — `A2 (staging)` + `C` + `L(UX-001, UX-002, UX-003)`

**Blast radius:** staging apenas. Nenhuma migration em produção.
**Por que juntas:** A2 é infraestrutura, C é autenticação, L é frontend — três
superfícies disjuntas. Nenhuma toca as outras.
**Entrega:** promoção de ambiente funcionando, onboarding e MFA, e o portão
UX-001 destravado.
**Nota:** D pode ser *preparada* aqui (escrever o teste que pega TEN-002), mas
sua correção é pequena e cabe na Rodada 3.

## Rodada 3 — `E` isolada

**Blast radius: o maior do plano.** Primeira fase com migrations contra banco
persistente com dado.
**Sozinha, de propósito.** Se algo der errado, a causa precisa ser inequívoca.
**Pré-condição:** restore validado (B) **e** rollback exercitado em staging (A2).
**Pode acompanhar:** D, que é pequena, não toca migration e se beneficia da
atenção já voltada para isolamento.

## Rodada 4 — `I` + `M` + `H` + `G`

**Blast radius:** médio. I converte tipos de data (migrations), M cria índices,
H e G são isolados.
**Atenção:** I é a maior fase do plano em esforço. Se o cronograma apertar,
dividir I em I-a (fuso, sem migration) e I-b (tipos de data, com migration).

## Rodada 5 — `F` + `J` + `K` + resto de `L`

**Blast radius:** baixo. Arquitetura, observabilidade, maturidade de CI/CD e UX.

## Rodadas finais — `N`(absorvida) · `O` · `P`

**Tratamento conservador, conforme pedido.**

- **O — piloto interno:** só equipe Vionex, só ambiente interno, Supplier Portal
  **fechado**, duas semanas, critério de saída explícito.
- **P — rollout:** um fornecedor de cada vez, começando por um país de acesso
  fácil. **Nunca big bang.** A China entra por último, e só depois do teste real
  de [35](35_CHINA_ACCESS_READINESS.md).

Nenhuma dessas rodadas agrupa fases. Cada degrau só começa com o anterior
estável.

---

# Preservação

Vale para todas as fases, sem exceção:

**Não refatorar sem finding específico e evidência.** Em particular, ficam
intocados — ver [37](37_DO_NOT_TOUCH.md) e as **13 hipóteses refutadas** de
[39](39_EVIDENCE_INDEX.md):

`src/server/authz/scopes.ts` · `src/server/authz/access.ts` ·
`src/server/authz/errors.ts` (guardas por nome, não `instanceof`) ·
`src/server/authz/rsc.ts` · a CSP de `src/proxy.ts` · os cabeçalhos de
`next.config.ts` · a fronteira servidor/cliente · o padrão de agregação por
`groupBy` · as migrations históricas · a autorização de download ·
`buildStorageKey` · `resolveKey` · o `DUMMY_HASH` · o throttle no banco ·
o `Content-Disposition` com RFC 5987.

**A intenção não é modernizar. É corrigir risco comprovado preservando o que está
certo.**
