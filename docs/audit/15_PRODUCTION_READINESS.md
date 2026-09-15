# 15 — Prontidão para produção

## Veredito: **NO-GO**

Não é uma avaliação sobre qualidade de engenharia. O código é bom — melhor que a
média para este estágio. O veredito é sobre um fato simples e verificável:

**Hoje, qualquer pessoa que abra `https://<host>/demo/enter?as=admin` recebe uma
sessão de administrador válida, sem senha.**

Existem três caminhos independentes para comprometimento total, e fechar apenas
um não resolve nada:

| # | Caminho | Evidência |
|---|---|---|
| 1 | `/demo/enter?as=admin` emite a sessão diretamente | `src/lib/demo.ts` → `isDemoEnabled()` retorna `true` literal |
| 2 | `/login` com `admin@vionex.com` / `vionex123` | `scripts/build-demo-snapshot.mjs` embarca esse hash no bundle |
| 3 | JWT forjado com a chave publicada no repositório | `src/lib/env-schema.ts` → `DEMO_SIGNING_KEY` como default de `AUTH_SECRET` |

Isso foi uma **decisão consciente e documentada** para permitir a avaliação
visual sem credenciais, e é a decisão certa para uma demonstração com dados
fictícios. O `src/lib/demo.ts` diz textualmente que a função precisa retornar
`false` antes de dados reais. O problema não é a decisão — é que **nada no
sistema força, detecta ou alerta esse momento**, e o único teste sobre o assunto
(`tests/unit/demo-mode.test.ts`) afirma que o comportamento aberto é o desejado.

## Avaliação por dimensão

| Dimensão | Estado | Bloqueia? |
|---|---|---|
| **Autenticação** | Login bem construído: throttle no banco, hash dummy contra enumeração, bcrypt custo 12. **Mas** a porta lateral sem senha anula tudo | **SIM** |
| **Autorização** | Matriz de capacidades limpa, testada, aplicada em toda server action. Sem IDOR — verificado nas 7 guardas e em todas as rotas parametrizadas | Não |
| **Isolamento entre fornecedores** | Correto por leitura. Escopo composto dentro da consulta, âncora dupla, falha fechada. **Mas** sem teste que rode de fato e sem RLS embaixo | **SIM** (TEST-001) |
| **Isolamento Vionex ↔ fornecedor** | **Furado.** `ProjectStage.notes` e `Project.blockerNote` chegam ao navegador do fornecedor | **SIM** (TEN-002) |
| **Banco** | Schema bem modelado, migrations limpas, sem drift, sem SQL interpolado, sem N+1. Integridade referencial incoerente em 3 pontos | Não |
| **Migrations** | Higiene boa. **Mas nenhuma etapa do deploy as aplica** | **SIM** (GOV-002) |
| **Persistência** | Sem `DATABASE_URL` a aplicação **serve sobre um banco em memória** e o health check responde 200 | **SIM** (DB-007) |
| **Backup / restore** | **Não avaliável** — não há banco gerenciado configurado, nenhum backup, nenhum procedimento de restore | **SIM** |
| **Storage** | Desenho correto (nada público, tudo reescopado). **Mas** `local` em produção aceita e perde o arquivo | **SIM** (STO-003) |
| **Segredos** | Nenhum segredo real versionado. `.env` fora do git. **Mas** o default de `AUTH_SECRET` é público | **SIM** (SEC-003) |
| **TLS / cabeçalhos** | Exemplar: HSTS com preload, CSP com nonce e `strict-dynamic`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP, `no-store` universal | Não |
| **Rate limit** | Só no login, e o eixo de IP é contornável | Não |
| **Logging** | 13 `console.error` com prefixo, **zero debug leftovers**. Nada mais | **SIM** (OPS-001) |
| **Monitoramento / alerta** | **Inexistente.** Um 500 em produção é indistinguível de silêncio | **SIM** (OPS-001) |
| **Trilha de auditoria** | 21 ações registradas, incluindo download e mudança de papel. **Mas** write-only, sem leitura, sem proteção no banco, e perde entradas em silêncio | Não |
| **CI/CD** | Pipeline escrito e correto — **e não instalado**. Todo push vai direto para produção | **SIM** (GOV-001) |
| **Rollback** | Vercel permite promover um deploy anterior. Não há procedimento para o banco | Não |
| **Testes** | 96 testes de boa qualidade. **Os 14 de isolamento são pulados em silêncio sem banco local** | **SIM** (TEST-001) |
| **Performance** | Sem N+1, listas principais paginadas, índices coerentes com o acesso. 14+ consultas sem limite | Não |
| **Confiabilidade** | Transações nos lugares certos. Sem timeout, sem idempotência, sem compensação de falha parcial | Não |
| **Privacidade** | Sem caminho técnico de exclusão; sem mapa de fluxo de dados; sem política de retenção | Não (mas ver [12_DATA_GOVERNANCE.md](12_DATA_GOVERNANCE.md)) |

## Os 10 bloqueadores, por subfase

A antiga Fase A foi dividida em **A0 / A1 / A2** — ver
[26_MASTER_IMPLEMENTATION_PLAN.md](26_MASTER_IMPLEMENTATION_PLAN.md) revisão 2.

| Bloqueador | Subfase | Impacto no banco |
|---|---|---|
| SEC-001 · `/demo/enter` sem senha | **A1** | nenhum |
| SEC-002 · senha `vionex123` no snapshot | **A1** | nenhum |
| SEC-003 · `AUTH_SECRET` publicado | **A1** | nenhum |
| DB-007 · banco embutido em produção | **A1** | nenhum |
| STO-003 · storage local em produção | **A1** | nenhum |
| TEST-001 · testes pulados em silêncio | **A1** | nenhum |
| GOV-001 · CI não instalado | **A1** | nenhum |
| TEN-002 · campos internos vazando | **D** | nenhum |
| OPS-001 · nenhum alerta | **J** | nenhum |
| GOV-002 · migrations fora do deploy | **A2** | **sim — depende de B** |

Sete dos dez cabem em **A1**, que não toca banco persistente e é inteiramente
reversível. Apenas GOV-002 exige banco, e por isso foi separado para A2.

Em ordem de execução recomendada:

1. **SEC-001** — `isDemoEnabled()` passar a depender do ambiente, e `/demo` virar 404 fora de desenvolvimento.
2. **SEC-002** — Gerar senhas aleatórias no seed e forçar troca no primeiro acesso; remover o snapshot de qualquer build com `DATABASE_URL`.
3. **SEC-003** — `AUTH_SECRET` obrigatório em produção, sem default.
4. **DB-007** — Recusar o boot em produção sem `DATABASE_URL`, em vez de trocar de banco silenciosamente.
5. **STO-003** — Recusar o boot em produção com `STORAGE_DRIVER=local`, **ou** avisar o usuário na interface no momento do upload.
6. **GOV-001** — Mover `ci/github-ci.yml` para `.github/workflows/` e exigir que passe antes do merge.
7. **GOV-002** — Adicionar `prisma migrate deploy` ao pipeline de deploy.
8. **TEST-001** — Fazer a suíte **falhar** quando o banco está inalcançável, em vez de pular.
9. **TEN-002** — `select` explícito no caminho do fornecedor, ou flag `internal` em `ProjectStage`/`Milestone`.
10. **OPS-001** — Error monitoring e alerta mínimos, para que uma falha em produção chegue a alguém.

Nenhum desses é uma reescrita. Somados, são poucos dias de trabalho — quase todos
são configuração, guardas de ambiente e um `select`.

## Caminho para CONDITIONAL GO

Concluídos os 10 bloqueadores, com o backup validado por um restore real, a
avaliação passa a **CONDITIONAL GO** para um piloto interno — ambiente interno
apenas, sem abrir o Supplier Portal, sem dados reais de fornecedor.

O Supplier Portal exige adicionalmente os bloqueadores globais de
[30_GLOBAL_READINESS.md](30_GLOBAL_READINESS.md).
