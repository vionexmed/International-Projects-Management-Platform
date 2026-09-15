# 07 — Mudanças de schema necessárias

> **Nada foi executado.** Nenhuma migration foi criada nem aplicada. Esta é a
> lista para sua aprovação, conforme a Parte 6 do pedido.

A conclusão foi deliberadamente conservadora: onde a funcionalidade pode ser
entregue **sem** tocar no banco, isso está registrado — e é a maioria dos casos.

## Resumo

| # | Mudança | Ranking | Migration? |
|---|---|---|---|
| 1 | `MessageAttachment` | **BLOQUEANTE** | sim, aditiva |
| 2 | `DocumentRequestReply.author` (FK) | IMPORTANTE | sim, aditiva |
| 3 | `DocumentRequestReview` (histórico) | IMPORTANTE | sim, aditiva |
| 4 | `RequestStatus.CHANGES_REQUESTED` | DESEJÁVEL | sim, isolada |
| 5 | `Project.progress` materializado | DESEJÁVEL | sim, aditiva |
| 6 | Marcador interno por campo | DESEJÁVEL | sim, aditiva |

**E seis funcionalidades que NÃO precisam de schema** — listadas ao final,
porque é o que muda o plano.

---

### 1 · `MessageAttachment` — **BLOQUEANTE**

**O quê:** `MessageAttachment { id, messageId, documentId, createdAt }`,
reaproveitando `Document`/`DocumentVersion` e a rota `/api/files/[versionId]` que
já existem, em vez de um segundo pipeline de arquivos.

**Por quê:** "mensagens com anexo quando aplicável" é requisito explícito e
**não tem nenhum suporte** — `Message` não tem relação de anexo alguma.

**Depende:** anexar arquivo a uma mensagem, nos dois sentidos.
**Modelos:** `Message`, `Document`.
**Migration:** aditiva (tabela nova + FKs). **Sem backfill.**

**Risco:** se o anexo apontar para `Document`, é preciso garantir
`visibility = SHARED_WITH_SUPPLIER` quando a thread tem `withSupplier = true` —
caso contrário `documentScope` nega o download e o anexo aparece quebrado do
lado do fornecedor. É a única armadilha, e é evitável na criação.

**Sem migration?** **Não.** Restaria colar um link no corpo da mensagem: sem
metadado, sem contagem, sem controle de visibilidade.

---

### 2 · `DocumentRequestReply.author` — IMPORTANTE

**O quê:** `authorId` já existe e já é gravado, **mas não tem FK nenhuma**.
Acrescentar a relação com `User`.

**Por quê:** não é possível exibir quem escreveu a resposta, nem distinguir uma
resposta da Vionex de uma do fornecedor. A tela do fornecedor hoje mostra as
respostas **sem autor** — a ausência já é visível no produto.

**Migration:** aditiva — a coluna existe, adiciona-se a FK.

**Risco real:** a criação da FK **falha** se houver algum `authorId` órfão.
Verificar antes. `onDelete: SetNull` exigiria tornar a coluna nullable, o que é
destrutivo em nível de tipo; recomendo `Restrict`, coerente com as vizinhas.

**Sem migration?** Parcialmente — daria para buscar os usuários à mão a cada
leitura. Funciona e deixa a integridade referencial na mão da aplicação, que é
exatamente o que o resto do schema evita.

---

### 3 · `DocumentRequestReview` — IMPORTANTE

**O quê:** `{ id, requestId, reviewerId, status, note, createdAt }`, mantendo os
campos atuais do `DocumentRequest` como denormalização da última revisão.

**Por quê:** `reviewNote` é **sobrescrito** a cada revisão. No ciclo
rejeita → reenvia → rejeita de novo, o motivo anterior desaparece — do fornecedor
e do banco. Numa cadeia regulatória de dispositivos médicos, é perda de rastro.

**Migration:** aditiva. Backfill opcional de uma linha por solicitação já
revisada (o revisor é recuperável do `AuditLog`).

**Sem migration?** Parcialmente. O `AuditLog` registra `document.review` com o
status, **mas não guarda a nota** — e consultar auditoria para renderizar
produto é uso indevido daquela tabela.

---

### 4 · `RequestStatus.CHANGES_REQUESTED` — DESEJÁVEL

Distingue "rejeitado, encerrado" de "pedimos de novo, ainda aberto". Hoje
`listDocumentRequests` trata `REJECTED` como aberto, e o fornecedor não sabe se
deve reenviar.

**Atenção técnica:** `ALTER TYPE ... ADD VALUE` **não roda dentro de transação**
no Postgres — exige migration isolada. E o TypeScript acusa em
`REQUEST_STATUS_TONE` (`Record<RequestStatus, Tone>`), o que é bom: o compilador
aponta todos os lugares a atualizar.

**Sem migration?** Sim — `REJECTED` + `reviewNote` já comunicam a intenção. É
refinamento de clareza, não de capacidade.

---

### 5 · `Project.progress` materializado — DESEJÁVEL

Hoje o progresso é recalculado a cada render, e ordenar a lista por progresso é
impossível no banco. Desnormalização: fica obsoleto se algum caminho de escrita
esquecer de chamar `recalculateProject`. **Só vale quando o volume justificar.**

---

### 6 · Marcador interno por campo — DESEJÁVEL

Hoje só existe marcação por **linha** (`TimelineEvent.internal`,
`TaskComment.internal`, `Document.visibility`). Notas de etapa são um campo só.

**Já resolvido sem schema nesta rodada:** os campos internos simplesmente não são
selecionados para o fornecedor. Só vale migrar se o produto quiser notas de
etapa **explicitamente compartilháveis** — aí seriam duas colunas.

---

## Funcionalidades que **não** precisam de schema

O ponto mais importante deste documento.

| Funcionalidade | Por que não precisa |
|---|---|
| **Timeline interna versus visível** | `TimelineEvent.internal` já existe. Falta passar `internal: true` nos call sites — dois já feitos nesta rodada |
| **Notificação de prazo próximo/vencido** | `TASK_DUE_SOON` e `TASK_OVERDUE` já estão no enum. Falta o disparador: uma rota de cron protegida. Deduplicar consultando `Notification` na janela evita até a coluna extra |
| **Arquivar projeto** | `Project.archivedAt`, `project:archive` e a ação de auditoria já existem. Falta a action, o item de menu e uma visão de arquivados |
| **Confinar permissões por etapa** | só mapeamento `StageKey` → permissão nas actions |
| **UI de usuários no portal** | `User.supplierId`, `userScope` e `addSupplierUserAction` já resolvem; falta a rota |
| **Status `OVERDUE` de tarefa** | **e não deve virar coluna.** É derivado em `deriveTaskStatus`, e é por isso que o sistema não precisa de job para manter status verdadeiros. Filtrar no banco resolve-se com `status NOT IN (COMPLETED, CANCELLED) AND dueDate < now()`, aproveitando o índice que já existe |

**Recomendação:** executar tudo o que não precisa de migration primeiro. Só
depois abrir a rodada de schema, com as mudanças 1, 2 e 3 juntas — e, conforme a
auditoria de produção, **só depois de backup e restore validados**.
