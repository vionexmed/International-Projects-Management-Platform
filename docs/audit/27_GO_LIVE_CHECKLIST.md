# 27 — Checklist de go-live

Critérios objetivos. Item sem marca é item que bloqueia.

> Ordem de execução e agrupamento por rodada em
> [26_MASTER_IMPLEMENTATION_PLAN.md](26_MASTER_IMPLEMENTATION_PLAN.md).
> Os itens abaixo estão agrupados pelo que verificam, não pela fase que os entrega.

## Antes de qualquer dado real

- [ ] `isDemoEnabled()` depende do ambiente; `/demo` e `/demo/enter` retornam 404 em produção
- [ ] Nenhuma conta com senha conhecida; seed remoto gera senha aleatória
- [ ] `AUTH_SECRET` obrigatório em produção, sem default
- [ ] `APP_ENV` explícito, com precedência documentada e testada
- [ ] Em `staging`/`production`, **recusa a inicialização** sem `DATABASE_URL`, sem `AUTH_SECRET` seguro, ou sem storage persistente
- [ ] Banco embutido, snapshot de demonstração e credenciais conhecidas **proibidos** em `preview`/`staging`/`production`
- [ ] Modo demo **declarado**, nunca inferido de configuração ausente
- [ ] Achados CRITICAL = **0**
- [ ] Achados HIGH que bloqueiam produção = **0**

## Dados

- [ ] Postgres gerenciado provisionado, com backup automático
- [ ] **Restore executado de verdade** num ambiente separado, cronometrado e documentado
- [ ] RPO e RTO **medidos**, não estimados
- [ ] Backup do storage configurado e verificado
- [ ] Região dos dados decidida e registrada em arquivo versionado

## Isolamento

- [ ] `npm test` **falha** quando o banco está inalcançável — nunca termina verde com suíte pulada
- [ ] Contrato do CI por invariante: `0 failed`, `0 unexpected skipped`, suítes críticas executadas — **sem contagem fixa**
- [ ] `npm run test:unit` roda sem nenhuma infraestrutura
- [ ] `npm run typecheck` passa **num checkout limpo**, sem build prévio
- [ ] Teste que falha se campos internos aparecerem no payload do fornecedor
- [ ] Isolamento verificado manualmente por HTTP: fornecedor A → projeto de B = 404, e o espelho
- [ ] Download entre fornecedores = 404, verificado por HTTP

## Autorização

- [ ] Matriz papel × recurso × ação revisada e aprovada pelo negócio
- [ ] Toda rota parametrizada verificada contra IDOR
- [ ] Toda server action com `requirePermission`

## Migrations

- [ ] `prisma migrate deploy` no pipeline, antes de o novo código receber tráfego
- [ ] Nenhuma migration histórica editada, movida ou renomeada
- [ ] Migration inversa escrita e testada em staging para cada mudança destrutiva

## Operação

- [ ] Error monitoring ativo, com alerta chegando a um humano
- [ ] Log estruturado, sem segredo e sem conteúdo de documento
- [ ] Alerta em `[audit] failed to record entry` e em `[throttle] check failed`
- [ ] `/api/health/live` e `/api/health/ready` separados; **nenhum devolve detalhe a anônimo**
- [ ] Readiness cobre ambiente, banco (e que **não** é o embutido), storage, schema, demo desligado e segredo seguro
- [ ] Rollback documentado e **exercitado ao menos uma vez**

## Pipeline

- [ ] CI instalado em `.github/workflows/`, verde obrigatório para merge
- [ ] `main` protegida, sem push direto
- [ ] Staging existe, com banco, storage e secrets próprios
- [ ] Preview por PR
- [ ] Configuração de deploy versionada

## Segurança

- [ ] Segredos isolados por ambiente, nenhum compartilhado
- [ ] CSV neutraliza `=`, `+`, `-`, `@`
- [ ] Throttle por IP resistente a `X-Forwarded-For` forjado
- [ ] Rate limit em `/api/search`, `/api/files` e nas server actions
- [ ] Trocar a senha invalida as sessões existentes
- [ ] MFA disponível ao menos para ADMIN
- [ ] `toActionError` só devolve mensagens de uma allowlist

## Global — obrigatório antes de abrir o Supplier Portal

- [ ] Semântica do prazo **decidida** e documentada
- [ ] `daysUntil`, `deriveTaskStatus` e `isOverdue` unificados e com teste de fuso
- [ ] Matriz de fusos passando — ver [36](36_GLOBAL_TEST_MATRIX.md)
- [ ] Tela de login no idioma do usuário
- [ ] Erros de servidor traduzíveis
- [ ] Componentes compartilhados sem texto em português
- [ ] `<html lang>` reflete o locale
- [ ] Fornecedor consegue sair e trocar de idioma no celular
- [ ] Portal testado fora do Brasil
- [ ] **Se houver rollout na China:** teste real de acesso executado — ver [35](35_CHINA_ACCESS_READINESS.md)

## Portão duro antes de qualquer fornecedor externo

> **NENHUM PILOTO COM FORNECEDOR EXTERNO antes de UX-001 estar resolvido e
> testado.**

- [ ] **UX-001** — o formulário **não** apaga o que foi digitado quando a ação falha
- [ ] **UX-002** — o upload mostra progresso
- [ ] **UX-003** — a zona de arquivo não fica com arquivo fantasma após o envio
- [ ] Os três verificados **em rede lenta e com queda no meio do envio**

Um fornecedor do outro lado do mundo, numa conexão instável, que perde a nota
digitada e o arquivo selecionado no mesmo instante em que lê uma mensagem de
erro, não tenta de novo. Este portão não é sobre polimento — é sobre a
plataforma ser utilizável para quem ela existe para servir.

## Rollout gradual

Sem big bang. Cada degrau só começa com o anterior estável.

```
local → preview → staging → piloto interno (só Vionex, 2 semanas)
                                    │
                          → 1 fornecedor parceiro (em país de fácil acesso)
                                    │
                          → 3 fornecedores (incluindo 1 na Europa)
                                    │
                          → produção limitada
                                    │
                          → rollout global (incluindo China)
```

| Degrau | Critério de avanço |
|---|---|
| Piloto interno | duas semanas sem incidente; auditoria legível; alerta funcionando |
| 1 fornecedor | isolamento verificado em produção; upload e download funcionando; fuso correto |
| 3 fornecedores | nenhum vazamento; latência aceitável na Europa |
| Produção limitada | backup restaurado com sucesso ao menos uma vez em produção |
| Global | teste real da China concluído; matriz global passando |

**Feature flags** permitiriam abrir o portal por fornecedor, sem deploy. Não
existem hoje; seriam o mecanismo natural para esse rollout.
