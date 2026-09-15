# 19 — Confiabilidade

## REL-001 — Falha parcial entre storage e banco · **MEDIUM**

`src/server/services/documents.ts` → `uploadDocument`. É o único ponto do sistema
onde dois sistemas precisam ter sucesso juntos.

Ordem real:
1. `validateUpload`
2. checagens de escopo
3. **`await storage().put(storageKey, buffer, ...)`** ← escrita no storage
4. **`await db.$transaction(...)`** ← Document + DocumentVersion + `currentVersionId`
5. `recordTimelineEvent` — **fora** da transação
6. `recordAudit` — **fora** da transação

| Cenário | Estado final | Compensação |
|---|---|---|
| Storage OK, transação falha | **objeto órfão** no storage, nada no banco | **nenhuma** — não há `storage().delete()` em nenhum `catch`, nem varredura, nem job |
| Storage falha | nada escrito, limpo | n/a |
| Transação OK, timeline falha | documento existe, histórico sem o evento, auditoria nunca roda. O usuário vê erro e **reenvia** → segunda versão do mesmo arquivo | nenhuma |
| Transação OK, auditoria falha | documento existe, **auditoria perdida em silêncio** | engolida por design |

A priorização está **correta** e documentada no código: *"an orphaned object is
harmless, while a database row pointing at a missing object is not."* O que falta
é a outra metade — nada nunca varre os órfãos.

`DocumentVersion.checksum` existe no schema e **nunca é preenchido**. É
exatamente a coluna necessária para reconciliar storage contra banco.

## REL-002 — `submitDocumentRequest` encadeia duas transações · **HIGH**

Mesma função-família, pior:

1. `await uploadDocument(...)` — transação própria, **commitada**
2. `await db.$transaction(...)` — marca `SUBMITTED`, grava `submittedAt`, cria o reply, move a tarefa

Falha entre 1 e 2: **o documento existe e está visível, mas a solicitação
continua `PENDING`.** O fornecedor vê que ainda deve algo que já entregou; a
Vionex vê a pendência aberta. Sem compensação, sem detecção. No reenvio,
`uploadDocument` cria uma **v2** do mesmo arquivo.

Para uma fila regulatória, é o pior estado possível.

## REL-003 — Sem timeout em nenhuma chamada externa · **MEDIUM**

| Item | Estado |
|---|---|
| Timeout S3 | **ausente** — `new S3Client({ region, endpoint, forcePathStyle, credentials })` sem `requestHandler`, `connectionTimeout`, `socketTimeout` ou `AbortSignal` |
| Retry S3 | implícito — 3 tentativas padrão do AWS SDK v3, **o que agrava a falta de timeout** |
| Timeout de banco | **ausente** — sem `statement_timeout`, `connect_timeout` ou `transactionOptions.timeout` |
| Idempotency keys | **nenhuma**, em nenhuma action ou tabela |
| Circuit breaker | nenhum |
| Rate limit | só no login |

Agravante no modo embutido: `src/server/demo/embedded-db.ts` usa `max: 1`, então
**uma query lenta bloqueia todas as requisições do processo**.

## Condições de corrida

| Corrida | Situação |
|---|---|
| **Numeração de versão de documento** | read-modify-write em READ COMMITTED. **`@@unique([documentId, version])` existe** e barra a duplicata — integridade preservada. Mas o P2002 vira *"Já existe um registro com estes dados."*, mensagem sem sentido para um upload, e deixa o objeto órfão de REL-001 |
| **`ensureProjectThread`** | `findFirst` → `create` sem transação e **sem unique em `(projectId, withSupplier)`**. Dois acessos simultâneos à página de mensagens de um projeto novo criam **duas threads**; cada lado escreve na sua |
| **`recalculateProject`** | read-modify-write sem transação e sem lock otimista. Convergente na prática (o estado é derivado), mas pode gravar um evento de mudança de status espúrio |
| **`markThreadRead`** | protegido por `@@unique([messageId, userId])` + `skipDuplicates`. **Correto** |

## REL-005 — Duplo clique · **MEDIUM**

`useFormStatus().pending` desabilita o botão em todos os formulários — primeira
linha de defesa consistente. **Mas é só interface.** Sem JavaScript, com rede
lenta, ou com requisição forjada, nada no servidor impede a segunda execução.

| Ação | Duplo envio produz | Protegido por |
|---|---|---|
| `createProject` | rejeitado | `@@unique([organizationId, projectCode])` |
| `createUser` | rejeitado | `User.email @unique` |
| `createSupplier` | rejeitado | `@@unique([organizationId, name])` |
| `uploadDocumentAction` (novo) | **dois Documents, dois objetos no storage** | nada |
| `submitDocumentRequestAction` | **duas versões + dois replies** | nada |
| `requestDocumentAction` | **duas solicitações, duas tarefas, duas notificações ao fornecedor** | nada |
| `sendMessageAction` | **duas mensagens idênticas** | nada |
| `createTask` / `addTaskComment` | **duplicados** | nada |

Onde havia unicidade natural, o duplo clique é absorvido. Onde não havia — a
maioria das ações de conteúdo — ele duplica. Nenhuma é destrutiva, mas
`requestDocumentAction` duplicado manda **duas notificações** ao fornecedor e
cria duas pendências que alguém fechará à mão.

## O que está bem feito

- Transações nos lugares certos: `createProject` cria projeto + 4 etapas +
  timeline + auditoria atomicamente, passando `client: tx` para `recordAudit`.
- `verifySessionToken` falha fechado.
- `getCurrentUser` relê papel e `supplierId` a cada requisição e **recusa a
  sessão** se um papel de fornecedor não tiver vínculo — fail-closed no lugar exato.
- Throttle no Postgres, não em memória, com a justificativa escrita no código.
- `@@unique([documentId, version])` transforma corrida em erro, não em corrupção.
