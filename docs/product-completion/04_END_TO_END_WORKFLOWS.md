# 04 — Fluxos ponta a ponta

Cada fluxo abaixo foi traçado no código, função por função.

---

## Fluxo regulatório — o mais importante do produto

O exemplo real: *Stefany entra no projeto, identifica um documento necessário,
cria a solicitação, o fornecedor recebe, responde, a Vionex revisa.*

| # | Etapa | Implementação | Estado |
|---|---|---|---|
| 1 | Identificar o documento | `RequestDocumentDialog`, na aba Regulatório | ✔ |
| 2 | Criar solicitação | `requestDocumentAction` → `createDocumentRequest` | ✔ |
| 3 | Selecionar fornecedor | **não é escolhível** — vem de `project.supplierId` | ✔ por design |
| 4 | Definir prazo | `dueDate` | ✔ |
| 5 | Tarefa espelho | criada com `status: WAITING` | ⚠ ver A |
| 6 | Notificação ao fornecedor | `DOCUMENT_REQUESTED` → `supplierRecipients` | ✔ |
| 7 | Timeline | `DOCUMENT_REQUESTED` | ✔ |
| 8 | Fornecedor vê em Action Required | `listDocumentRequests` sob `documentRequestScope` | ✔ |
| 9 | Fornecedor abre e entende o pedido | título, tipo, solicitante, prazo, descrição | ✔ |
| 10 | Upload e/ou resposta | `SubmitRequestForm` → `submitDocumentRequest` | ✔ **melhorado nesta rodada** |
| 11 | Submissão | status → `SUBMITTED`, documento + versão criados | ✔ |
| 12 | Tarefa espelho avança | → `IN_PROGRESS` | ⚠ ver A |
| 13 | Notificação à Vionex | `SUPPLIER_REPLIED` ao solicitante e ao owner | ✔ |
| 14 | Timeline | `DOCUMENT_SUBMITTED` **e** `DOCUMENT_UPLOADED` | ⚠ ver D |
| 15 | Vionex encontra a submissão | **só pela notificação ou entrando no projeto** | ✖ ver B |
| 16 | Vionex baixa e revisa | **o diálogo de revisão não oferece download** | ✖ ver B |
| 17 | Aprovar / rejeitar | `reviewDocumentRequestAction` | ✔ |
| 18 | Notificação de volta | `DOCUMENT_REVIEWED` — **sem dizer o veredito** | ⚠ ver C |
| 19 | Fornecedor lê o motivo | `reviewNote` aparece, rotulado apenas "Vionex" | ⚠ |
| 20 | **Solicitar de novo** | **não existe** | ✖ ver E |

### Onde quebra

**A · A tarefa espelho nunca fecha.** `reviewDocumentRequest` não toca na tarefa.
Aprovar o documento deixa a tarefa aberta para sempre — e ela alimenta
`recalculateProject` e `stageProgress`, então o progresso do projeto fica
permanentemente subestimado. **P0.**

**B · Não existe caixa de entrada de submissões, e a revisão é cega.** O revisor
só descobre pela notificação; e na tela de revisão não há link para baixar o
arquivo que ele está aprovando. Decidir sem abrir o documento é o comportamento
que a interface induz hoje. **P0.**

**C · A notificação de revisão não diz o veredito.** `"Vionex reviewed your
submission."` é idêntica para aprovado e rejeitado. **P1.**

**D · Dois eventos de timeline para o mesmo ato.** `DOCUMENT_UPLOADED` seguido de
`DOCUMENT_SUBMITTED`. **P2.**

**E · `REJECTED` é estado terminal.** Nenhuma ação devolve a solicitação para
`PENDING` nem abre nova rodada. O fornecedor reenvia por cima, e `reviewNote` e
`submittedAt` são **sobrescritos** — o motivo da rejeição anterior desaparece da
tela e do banco. Numa cadeia regulatória, é perda de rastro. **P0.**

---

## Projeto → etapas → marcos → tarefas → progresso

| Etapa | Estado |
|---|---|
| `createProject` cria as 4 etapas e a thread numa transação | ✔ |
| Marcos | **não há UI** — `createMilestoneAction` órfã |
| Tarefas → `recalculateProject` re-deriva status e etapa atual | ✔ |
| `ProjectStage.progress` persistido | **nunca gravado** — a tela usa `computedProgress` a cada render |
| `MILESTONE_REACHED` | no enum, nunca emitido |

**Veredito: PARCIAL.** Os módulos conversam; falta a UI de marcos e de etapas.

---

## Tarefa atribuída ao fornecedor

O banco grava `supplierId`, `taskScope` foi escrito para isso — e **nenhuma
página do portal importa `services/tasks`**. Não há aba "Tasks" no portal.
`TASK_ASSIGNED` vai só para o usuário interno.

**Veredito: QUEBRADO na ponta.** O dado existe, a UI não. **P1.**

---

## Mensagens nos dois sentidos

Persiste, atualiza a thread, grava timeline, audita e notifica o outro lado com
o link correto por papel. Não-lidas por `MessageRead`.

**Veredito: COMPLETO.** Falta anexo (exige schema — ver [07](07_SCHEMA_CHANGES_REQUIRED.md))
e abrir conversa nova.

---

## Documento interno compartilhado com o fornecedor

| Etapa | Estado |
|---|---|
| Checkbox no upload → `visibility: SHARED_WITH_SUPPLIER` | ✔ |
| `documentScope` filtra por isso | ✔ |
| **Notificar o fornecedor** | ✖ `DOCUMENT_RECEIVED` nunca é emitido |
| **Mudar a visibilidade depois** | ✖ nenhuma ação altera; o ramo de update ignora o campo |

**Veredito: PARCIAL.** Marcar errado só se corrige no banco. **P1.**

---

## Upload avulso do fornecedor

Funciona e **não notifica ninguém**. Um certificado enviado espontaneamente pode
passar semanas despercebido. **P1.**

---

## Prazo vencendo / vencido

Nenhum agendador. `TASK_DUE_SOON` e `TASK_OVERDUE` são letra morta. Atraso é
calculado no render.

**Veredito: AUSENTE.** A plataforma nunca avisa ninguém de nada. **P1.**
