# 11 — Entrega de PC-1 + PC-3

Executado em 15/09/2026. **Nenhuma alteração de schema, nenhuma migration.**

## PC-1 — ligar o que já existe

| Item | O que passou a existir | Ponta a ponta |
|---|---|---|
| **I-3** editar membro | `EditMemberDialog` → `updateUserAction` | UI → Zod → permissão → `userScope` → persistência → toast → `revalidatePath` → auditoria (`user.role_change` ou `user.update`) |
| **I-4** editar fornecedor | `EditSupplierDialog` → `updateSupplierAction` | idem, incluindo `SupplierStatus`, que alimenta os gargalos do dashboard e antes só podia ser definido na criação |
| **I-5** editar etapa | `EditStageDialog` → `updateStageAction` | status, progresso e notas internas; progresso vazio devolve o cálculo às tarefas; dispara `recalculateProject` |
| **I-6** criar marco | `NewMilestoneDialog` → `createMilestoneAction` | com etapa opcional, prazo, timeline e recálculo |
| **I-1** arquivar projeto | `setProjectArchived` + `setProjectArchivedAction` + aba "Arquivados" + reabrir | ver abaixo |
| **I-2** segundo embarque | botão movido para fora do ramo `length === 0` | um projeto com produção parcelada deixou de travar no primeiro embarque |

### Arquivamento, em detalhe

`Project.archivedAt` era filtrado por quatro escopos e **nunca escrito**. Agora:

- **Soft close, nunca delete.** As linhas ficam, as relações ficam, a auditoria fica.
- **`projectScope` ganhou uma opção `archived: "only"`** — e ela é **ignorada para
  sessão de fornecedor**. Um projeto arquivado é assunto encerrado; nenhum
  argumento que um chamador passe deve reabri-lo do lado do portal.
- **Reabrir existe**, e foi entregue junto. Um arquivo do qual não se volta é um
  delete com nome mais gentil.
- **O evento de timeline é interno** — o fornecedor perde o projeto de vista por
  inteiro, e registrar o ato como interno mantém as duas coisas coerentes.
- **Redireciona ao confirmar**, porque a página de detalhe sai do escopo padrão
  no instante em que o projeto é arquivado.

## PC-3 — fazer a plataforma avisar

| Evento | Antes | Agora | Destinatário |
|---|---|---|---|
| Upload avulso do fornecedor | silencioso | `DOCUMENT_RECEIVED` | responsável pelo projeto |
| Documento compartilhado pela Vionex | silencioso | `DOCUMENT_RECEIVED` | usuários do fornecedor |
| Documento `INTERNAL_ONLY` | — | **nada, deliberadamente** | ninguém do lado do fornecedor |
| Tarefa esperando o fornecedor | só o usuário interno | `TASK_ASSIGNED` | **+ usuários do fornecedor** |
| Prazo próximo (≤ 3 dias) | nunca emitido | `TASK_DUE_SOON` | responsável + fornecedor |
| Prazo vencido | nunca emitido | `TASK_OVERDUE` | responsável + fornecedor |
| Status do projeto mudou | silencioso | `PROJECT_UPDATED` | responsável + fornecedor |
| Comentário **interno** em tarefa | notificava mesmo assim | **não notifica** quem é do fornecedor | — |

### Duplicidade

`notifyOnce` consulta `Notification` por `(userId, type, href)` dentro de uma
janela antes de gravar. A mesma ação reenviada, uma tarefa editada duas vezes, ou
um status que oscila deixam de encher o sino com a mesma linha.

Resolvido **sem coluna nova**: `href` já identifica o assunto e `type` a razão.

### Prazos — o que foi feito e o que depende de scheduler

Implementado o que é **evento**: atribuir trabalho já vencido, ou com prazo nos
próximos três dias, avisa no momento da escrita.

**Não implementado, e não simulado:** a varredura periódica. Uma tarefa que
*passa* a vencer amanhã porque um dia se passou não é um evento — não há escrita
para se pendurar. Cobrir isso exige algo que acorde sozinho (Vercel Cron ou
equivalente), e fingir que está pronto deixaria a notificação disparando para
umas tarefas e silenciosamente não para outras.

**Dependência registrada, não escondida.** Os tipos do enum já existem; quando o
agendador for criado, ele chama a mesma `notifyAboutDeadline`.

### Notificações do fornecedor

Criada `/supplier/notifications`, com "marcar como lida", e o sino do cabeçalho
passou a apontar para ela. Antes ele contava não-lidas e levava a Action
Required — uma lista que nunca marca nada como lido, então **o ponto vermelho
nunca apagava, para ninguém**.

## Timeline

Nenhuma timeline paralela. Os mesmos eventos, com `internal` correto:

| Evento | `internal` |
|---|---|
| Etapa atualizada (status, progresso, notas) | **true** |
| Estudo clínico atualizado | **true** |
| Item regulatório adicionado | **true** |
| Embarque atualizado | **true** |
| Projeto arquivado / reaberto | **true** |
| Documento `INTERNAL_ONLY` enviado | **true** (já em rodada anterior) |
| Tarefa sem fornecedor | **true** (já em rodada anterior) |
| Documento solicitado / submetido / revisado | false — é a conversa com o fornecedor |
| Mensagem enviada | false |
| Projeto criado, status alterado | false |

## Decisões de permissão

Ver [05_PERMISSIONS_MATRIX.md](05_PERMISSIONS_MATRIX.md), seção de decisões.

## Testes acrescentados

| Arquivo | Testes | Cobre |
|---|---:|---|
| `tests/integration/user-management.test.ts` | 10 | fronteira do SUPPLIER_ADMIN, nos dois sentidos |
| `tests/integration/project-lifecycle.test.ts` | 6 | arquivar, esconder do fornecedor, listar o arquivo, reabrir, escopo |
| `tests/integration/notifications.test.ts` | 9 | quem recebe o quê, e sobretudo quem **não** recebe |
| `tests/unit/stage-permissions.test.ts` | 4 | mapeamento etapa → permissão |
| `tests/unit/form-reset.test.ts` | 5 | regressão do UX-001, como propriedade estrutural |

**34 testes novos.** Total: 81 unitários + 76 integração = **157**.

## Riscos residuais

| Risco | Mitigação |
|---|---|
| `REGULATORY` perdeu o status da etapa de importação | consequência direta de `STAGE_MANAGE`. Se a Vionex quiser o contrário, é uma linha na matriz |
| SUPPLIER_ADMIN não pode nomear outro SUPPLIER_ADMIN | fail-closed deliberado, aguardando decisão |
| Notificação de prazo só cobre o momento da escrita | documentado acima; o enum já existe para o agendador |
| `notifyOnce` faz uma consulta a mais por notificação | aceitável no volume atual; o índice `Notification(userId, readAt)` não cobre `href`, então vale revisitar se o volume crescer |
