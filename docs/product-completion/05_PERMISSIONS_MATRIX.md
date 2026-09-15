# 05 — Matriz de permissões

## Declarada versus aplicada

24 permissões. **8 nunca são verificadas em lugar nenhum**: `project:read`,
`task:read`, `document:read`, `supplier:read`, `team:read`, `portal:access`,
`settings:manage`, `project:archive`.

Sete delas são inócuas — a leitura é governada pelos *scopes* e pelos guards de
layout, que fazem o trabalho de verdade. Mas a tela de Configurações afirma
*"Matriz aplicada no servidor em todas as operações"*, e para essas linhas isso
é **factualmente falso**.

`project:archive` é a exceção: representa funcionalidade inteiramente ausente.

## Matriz efetiva — o que cada papel realmente consegue fazer

| Ação real | ADMIN | MANAGER | REGULATORY | IMPORT | MARKETING | VIEWER | SUP_ADMIN | SUP_USER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Criar projeto | ✔ | ✔ | ✔ | — | — | — | — | — |
| **Editar projeto (todos os campos)** | ✔ | ✔ | ✔ | **✔** | **✔** | — | — | — |
| Arquivar projeto | **impossível para todos** | | | | | | | |
| Criar / editar / mover tarefa | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Enviar documento | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| **Baixar documento `INTERNAL_ONLY`** | ✔ | ✔ | ✔ | ✔ | ✔ | **✔** | — | — |
| Solicitar documento | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | — |
| **Revisar documento regulatório** | ✔ | ✔ | ✔ | **✔** | **✔** | — | — | — |
| Responder solicitação | — | — | — | — | — | — | ✔ | ✔ |
| Editar estudo clínico | ✔ | ✔ | ✔ | — | — | — | — | — |
| Item regulatório | ✔ | ✔ | ✔ | — | — | — | — | — |
| Embarque | ✔ | ✔ | — | ✔ | — | — | — | — |
| Item de Go-to-Market | ✔ | ✔ | — | — | ✔ | — | — | — |
| **Editar etapa de QUALQUER fase** | ✔ | ✔ | ✔ | **✔** | **✔** | — | — | — |
| Convidar membro / mudar papel | ✔ | — | — | — | — | — | — | — |
| Criar usuário de fornecedor | ✔ | — | — | — | — | — | ✔ **sem UI** | — |
| Criar / editar fornecedor | ✔ | ✔ | — | — | — | — | — | — |
| Exportar CSV | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — |
| Enviar mensagem | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| Marcar conversa como lida | ✔ | ✔ | ✔ | ✔ | ✔ | **—** | ✔ | ✔ |
| Alterar configurações | **impossível para todos** | | | | | | | |

## Divergências que precisam de decisão

| # | Divergência | Evidência | Prioridade |
|---|---|---|---|
| **PERM-1** | **IMPORT e MARKETING editam qualquer campo de qualquer projeto** — inclusive trocar o responsável e marcar como concluído. `updateSchema` aceita tudo e não filtra por etapa | `updateProjectAction` | **P1** |
| **PERM-2** | **IMPORT e MARKETING aprovam e rejeitam documentos regulatórios** — herdam `document:review` de `PROJECT_CONTRIBUTOR` | `permissions.ts` | **P1** |
| **PERM-3** | **Status e notas de qualquer etapa** ficam fora de `STAGE_MANAGE` — `updateStageAction` e `createMilestoneAction` exigem só `project:update`. Um usuário IMPORT marca a etapa clínica como concluída | `actions/projects.ts`, `actions/stages.ts` | **P1** |
| **PERM-4** | **VIEWER baixa qualquer documento `INTERNAL_ONLY`** de qualquer projeto. `documentScope` não filtra `visibility` para papéis internos, e `/api/files/[versionId]` não checa `document:read` | `scopes.ts`, rota de arquivos | **P1** |
| **PERM-5** | `portal:manage-users` só é exercível por ADMIN, numa tela interna. Um SUPPLIER_ADMIN tem a permissão e **nenhuma UI** | `suppliers/[supplierId]` | **P1** |
| **PERM-6** | VIEWER não consegue marcar conversa como lida — `markThreadReadAction` exige `message:send` | `actions/messages.ts` | **P3** |
| **PERM-7** | `/settings` e `/regulatory` só exigem `requireInternalUser`. Um VIEWER vê a matriz inteira de permissões da organização | as duas páginas | **P2** |
| **PERM-8** | `settings:manage` só troca uma frase na tela | `settings/page.tsx` | **P3** |

## Autorização só no frontend: **nenhum caso**

Verificado um a um. Todo `can()` da interface tem `requirePermission`
correspondente na server action. As exceções (`settings:manage`, `project:update`
no layout) não destravam nenhuma escrita desprotegida.

Este ponto do desenho está correto e **não deve ser mexido**.

## Decisões tomadas em 15/09/2026

A instrução foi: não inventar permissão mais ampla, não flexibilizar para
facilitar, e diante de ambiguidade real de negócio **preservar o comportamento
mais restritivo**. Duas foram resolvidas; duas ficaram pendentes por serem
decisão sua, não de engenharia.

### PERM-3 · Etapas fora de `STAGE_MANAGE` — **RESOLVIDA**

| | |
|---|---|
| **Antes** | `updateStageAction` e `createMilestoneAction` exigiam apenas `project:update`. Um usuário IMPORT podia marcar a etapa clínica como concluída e escrever nas suas notas |
| **Pretendido** | cada etapa governada pela capacidade que leva o seu nome |
| **Implementado** | `STAGE_PERMISSION` mapeia `StageKey` → permissão; as duas actions passaram a exigir a permissão da etapa. Marco sem etapa continua em `project:update` |
| **Por quê** | claramente sustentado pela arquitetura existente: `STAGE_MANAGE` já declarava a separação e as actions de detalhe já a aplicavam. Não é permissão nova — é aplicar a que já estava escrita |
| **Teste** | `tests/unit/stage-permissions.test.ts` — verifica que cada especialista alcança a própria etapa e nenhuma outra, que ADMIN e MANAGER não perderam nada, e que VIEWER e fornecedores continuam fora |
| **Efeito colateral** | REGULATORY deixa de alterar o status da etapa de importação. É o que a matriz declara; se a Vionex quiser o contrário, é uma linha |

### PERM-4 · VIEWER e documentos `INTERNAL_ONLY` — **PARCIAL**

| | |
|---|---|
| **Antes** | `document:read` declarada e **nunca verificada**; `/api/files/[versionId]` só exigia sessão |
| **Pretendido** | a matriz exibida em Configurações afirma que é aplicada no servidor |
| **Implementado** | nada nesta rodada |
| **Pendente** | filtrar `INTERNAL_ONLY` para papéis sem `document:upload` mudaria o que um VIEWER real alcança hoje — contratos, NDAs e dossiês de todos os projetos. Restringir é a direção fail-closed, **mas é decisão de negócio**: ou o papel deixa de ler documentos internos, ou o nome "Visualizador" passa a refletir o alcance que tem |
| **Nota** | o isolamento do fornecedor nunca esteve em questão aqui — `documentScope` fixa `SHARED_WITH_SUPPLIER` e passa pela relação com o projeto |

### PERM-1 · `project:update` amplo demais — **PENDENTE**

| | |
|---|---|
| **Antes e agora** | IMPORT e MARKETING editam **qualquer** campo de qualquer projeto, inclusive trocar o responsável e marcar como concluído |
| **Por que não foi mexido** | restringir exige saber **quais** campos cada papel deveria editar, e nada na arquitetura responde isso. Qualquer recorte que eu escolhesse seria invenção minha — e o recorte mais restritivo (tirar `project:update`) quebraria o trabalho legítimo dos dois papéis |
| **Precisa de** | sua decisão sobre o subconjunto de campos, ou a confirmação de que o alcance atual é intencional |

### PERM-2 · `document:review` para IMPORT e MARKETING — **PENDENTE**

| | |
|---|---|
| **Antes e agora** | os dois herdam `document:review` de `PROJECT_CONTRIBUTOR` e aprovam ou rejeitam qualquer documento |
| **Por que não foi mexido** | "documento" não é só documento regulatório. Um responsável por importação revisando uma fatura comercial é legítimo; o mesmo papel aprovando um dossiê da ANVISA não é. O modelo não distingue os dois casos, e distinguir é decisão de produto |
| **Precisa de** | sua decisão: restringir `document:review` a ADMIN/MANAGER/REGULATORY, ou separar a revisão por tipo de documento |

## Proposta original para PERM-1 a PERM-4

Nenhuma exige schema. São decisões de produto que a engenharia executa:

1. **Confinar etapas**: mapear `StageKey` → permissão e exigir a da etapa em
   `updateStageAction` e `createMilestoneAction`. ADMIN e MANAGER têm as quatro,
   então nada muda para eles; REGULATORY perde o status da etapa de importação.
2. **Restringir `document:review`** a ADMIN, MANAGER e REGULATORY.
3. **Limitar `project:update`** por campo, ou aceitar o alcance atual
   explicitamente.
4. **Decidir o VIEWER**: ou `documentScope` passa a filtrar `INTERNAL_ONLY` para
   papéis sem `document:upload`, ou o papel é renomeado para refletir o que faz.

Cada uma muda comportamento de usuários reais. **Aguardam sua decisão.**
