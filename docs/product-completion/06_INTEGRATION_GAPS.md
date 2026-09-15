# 06 — Lacunas de integração

> Funcionalidades que funcionam sozinhas e não conversam. Esta é a categoria
> dominante do produto hoje.

## Matriz por workflow

| Workflow | Trigger | Lógica | Banco | Notificação | Timeline | UI interna | UI fornecedor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Solicitar documento | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Fornecedor submete | ✔ | ✔ | ✔ | ✔ | ⚠ duplicado | **✖ sem inbox, sem download** | ✔ |
| Revisar (aprovar/rejeitar) | ✔ | ✔ | ✔ | ⚠ sem veredito | ✔ | ✔ | ⚠ |
| **Solicitar de novo** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Upload avulso do fornecedor | ✔ | ✔ | ✔ | **✖** | ✔ | ⚠ | ✔ |
| Compartilhar documento interno | ✔ | ✔ | ✔ | **✖** | ✔ | ✔ | ✔ |
| Tarefa para o fornecedor | ✔ | ✔ | ✔ | **✖** | ✔ | ✔ | **✖ sem tela** |
| Mensagem (ambos sentidos) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Projeto / etapa / progresso | ✔ | ✔ | ⚠ | **✖** | ✔ | ✔ | ✔ |
| **Prazo vencendo / vencido** | **✖** | **✖** | ✖ | **✖** | ✖ | ⚠ render | ⚠ render |
| Marcos | **✖ sem UI** | ✔ | ✔ | ✖ | ✖ | ⚠ leitura | ⚠ leitura |
| Usuários do fornecedor | ✔ interno | ✔ | ✔ | ✖ | ✖ | ✔ | **✖ sem tela** |

## Notificações: evento → notifica?

| Evento | Notifica | Quem recebe | Deveria |
|---|:---:|---|---|
| Solicitação criada | ✔ | usuários do fornecedor | ✔ correto |
| Fornecedor submete | ✔ | solicitante + owner | ✔ correto |
| Documento revisado | ✔ | usuários do fornecedor | ✔ audiência certa, **texto sem veredito** |
| Mensagem enviada | ✔ | o outro lado | ✔ correto |
| Tarefa atribuída | ✔ | só o `assignedToId` | ✖ falta o fornecedor quando `waitingOnSupplier` |
| Comentário em tarefa | ✔ | assignee + criador | ⚠ **notifica mesmo quando `internal: true`** — se o assignee for do fornecedor, vaza |
| Upload avulso do fornecedor | **✖** | — | ✔ deveria avisar owner/solicitante |
| Documento compartilhado | **✖** | — | ✔ `DOCUMENT_RECEIVED` |
| Prazo próximo / vencido | **✖** | — | ✔ `TASK_DUE_SOON` / `TASK_OVERDUE` |
| Status do projeto mudou | **✖** | — | ✔ `PROJECT_UPDATED` |
| Marco atingido | **✖** | — | ✔ |
| Usuário de fornecedor criado | **✖** | — | ✔ (a senha é definida pelo interno; ninguém avisa o dono) |

**Quatro tipos declarados e nunca emitidos:** `TASK_DUE_SOON`, `TASK_OVERDUE`,
`DOCUMENT_RECEIVED`, `PROJECT_UPDATED`. E `MILESTONE_REACHED` na timeline.

## Timeline: interno versus visível ao fornecedor

`TimelineEvent.internal` existe e `timelineScope` filtra por ele. Antes desta
rodada, **nenhum serviço passava `internal: true`** — o filtro não filtrava nada.

| Evento | Registrado | Visível ao fornecedor | Correto? |
|---|:---:|---|---|
| `PROJECT_CREATED` | ✔ | sim | ✔ |
| `PROJECT_UPDATED` | ✔ | sim | ⚠ depende do campo alterado |
| `STATUS_CHANGED` | ✔ | sim | ⚠ decisão de produto |
| `STAGE_UPDATED` (clínico, importação) | ✔ | **sim** | ✖ é trabalho interno |
| `TASK_CREATED` / `TASK_UPDATED` / `TASK_COMPLETED` | ✔ | **só se a tarefa tiver fornecedor** | ✔ **corrigido nesta rodada** |
| `COMMENT_ADDED` | ✔ | só se `internal: false` | ✔ já estava correto |
| `DOCUMENT_UPLOADED` | ✔ | **só se não for `INTERNAL_ONLY`** | ✔ **corrigido nesta rodada** |
| `DOCUMENT_REQUESTED` / `SUBMITTED` / `REVIEWED` | ✔ | sim | ✔ |
| `MESSAGE_SENT` | ✔ | sim | ✔ |
| `MILESTONE_REACHED` | ✖ | — | falta emitir |

**O que resta:** `STAGE_UPDATED` de etapas internas e `PROJECT_UPDATED` quando o
campo alterado é `blockerNote` ou `description`. Ambos precisam de decisão de
produto sobre o que o fornecedor deve acompanhar — por isso não foram alterados
nesta rodada.

## Os elos que faltam, em ordem de impacto

1. **Revisão não fecha a tarefa espelho** — corrompe o progresso do projeto.
2. **Sem caixa de entrada de submissões e sem download na revisão** — o trabalho chega e ninguém é levado até ele.
3. **`REJECTED` sem "pedir de novo"** — o ciclo tem começo e não tem volta.
4. **Nada avisa sobre prazo** — a plataforma é passiva.
5. **Uploads do fornecedor são silenciosos.**
6. **Tarefas do fornecedor não têm tela.**
