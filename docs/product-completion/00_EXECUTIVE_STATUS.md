# 00 — Status do produto

**Vionex Projects** · 15 de setembro de 2026 · foco: **conclusão funcional**, não produção.

## Onde estamos

O produto **mostra** bem e **conecta** mal.

Quase todas as telas existem, carregam dados reais e respeitam o isolamento
entre fornecedores. O que falta não é interface — é o meio do caminho: ações que
existem no servidor e nunca foram ligadas a um botão, eventos que acontecem e
não notificam ninguém, e um ciclo de revisão de documento que abre e não fecha.

| | Início | PC-1 + PC-3 | **PC-2 + PC-4** |
|---|---:|---:|---:|
| **Completas** | 14 | 22 | **29** |
| **Parciais** | 12 | 9 | **4** |
| **Só visuais** | 3 | 2 | **2** |
| **Ausentes** | 8 | 3 | **0** |
| **Quebradas** | 3 | 0 | **0** |

## O que foi corrigido nesta rodada

| Item | Estado |
|---|---|
| **SEC-001** `/demo/enter` emitia sessão de ADMIN sem senha | **corrigido e verificado em runtime** — 404 em produção, sem cookie |
| **SEC-002** senha `vionex123` em todas as contas do snapshot | **contida** — o snapshot só é gerado e alcançável em ambiente de demonstração |
| **SEC-003** `AUTH_SECRET` assumia chave publicada | **corrigido** — recusado em `preview`/`staging`/`production` |
| **TEN-002** campos internos no navegador do fornecedor | **corrigido na consulta**, com teste de regressão |
| **TEN-002b** timeline interna visível ao fornecedor | **parcialmente corrigido** — dois casos inequívocos; o resto exige decisão de produto |
| **TEST-001** testes pulavam em silêncio | **corrigido e verificado** — sai com código 1 e diz o que fazer |
| **UX-001** formulário apagado ao falhar | **corrigido** — a causa estava no React, não no nosso código |
| **UX-002** upload sem sinal de progresso | **corrigido** — estado explícito, texto real, campos travados |
| **UX-003** arquivo fantasma após o envio | **corrigido** |
| **UX-012** fornecedor sem logout no celular | **corrigido** — idioma e sair no menu |

## PC-1 + PC-3 — executadas em 15/09/2026

**PC-1 ligou cinco ações que já existiam** — editar membro, editar fornecedor,
editar etapa, criar marco — e criou o arquivamento de projeto, que tinha coluna,
permissão e ação de auditoria e nenhum código que escrevesse nela. O bug do
segundo embarque foi corrigido.

**PC-3 acendeu a plataforma.** Quatro tipos de notificação declarados e nunca
emitidos passaram a existir: documento recebido, prazo próximo, prazo vencido e
mudança de status do projeto. O fornecedor ganhou tela de notificações — o ponto
vermelho do sino nunca apagava porque ele apontava para outra lista.

E dois vazamentos silenciosos foram fechados: um comentário interno deixou de
notificar um usuário de fornecedor, e a timeline de etapas internas deixou de ser
visível no portal.

## PC-2 + PC-4 — executadas em 15/09/2026

**PC-2 fechou o ciclo regulatório.** O revisor abre o arquivo na tela em que
decide; aprovar fecha a tarefa espelho e corrige o progresso do projeto; e
"rejeitado" deixou de ser o fim — vira **correção solicitada**, o fornecedor
reenvia, e o motivo da rodada anterior sobrevive.

**PC-4 completou o portal.** Usuários, tarefas e perfil passaram a existir. O
fornecedor administra a própria empresa, vê o trabalho que a Vionex espera, e
corrige o próprio nome.

**Um item ficou bloqueado corretamente:** o histórico **estruturado** de
revisões exige tabela nova — `SCHEMA BLOCKED — PC-5`. O texto de cada rodada
está preservado; o veredito de cada rodada como dado consultável, não.

## Os gaps que mais doem agora

**1. O ciclo de revisão não fecha.** A Vionex rejeita um documento e não existe
nenhuma ação que peça de novo. `REJECTED` é estado terminal; o fornecedor
reenvia e sobrescreve o motivo da rejeição anterior, que desaparece.

**2. Varredura de prazos depende de agendador.** O aviso na escrita existe; a
tarefa que *passa* a vencer porque um dia se passou não tem evento onde se
pendurar. **Não foi simulado.**

**3. Três divergências de permissão aguardam sua decisão** — PERM-1, PERM-2 e
PERM-4. Intocadas de propósito.

## O que está bom e não deve ser mexido

Isolamento entre fornecedores (verificado de novo nesta rodada, com teste novo),
o fluxo de mensagens ponta a ponta, tarefas, o ciclo de solicitação até a
submissão, os relatórios CSV, e a arquitetura de dois ambientes sobre um banco.

## Próximo passo

**Não há mais P0.** O que resta é acabamento (PC-6) e uma rodada de schema
(PC-5) que destrava três coisas: anexo em mensagem, autoria com integridade
referencial, e o histórico estruturado de revisões.

Recomendo **PC-5 antes de PC-6** — é a única com migration e merece atenção
isolada. Ver [09_PRODUCT_COMPLETION_PLAN.md](09_PRODUCT_COMPLETION_PLAN.md).

**Isto não é production readiness.** A auditoria de produção
([docs/audit/](../audit/)) continua válida e vem depois.
