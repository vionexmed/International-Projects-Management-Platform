# 12 — Entrega de PC-2 + PC-4

Executado em 15/09/2026. **Nenhuma alteração de schema, nenhuma migration.**

## PC-2 — o ciclo regulatório fecha

### Revisão sem download — resolvido

O revisor decidia sem conseguir abrir o arquivo. Agora o diálogo de revisão
mostra fornecedor, status, data de envio, prazo, e o **arquivo submetido com
versão e tamanho**, ligado por `/api/files/[versionId]` — a mesma rota
autenticada do resto do produto. Sessão revalidada, escopo reaplicado, download
auditado. Sem URL pública, sem segundo pipeline de documentos.

Quando o fornecedor respondeu sem anexo, o diálogo diz isso e manda ler o
histórico antes de decidir.

### Tarefa espelho — resolvido

| Estado da solicitação | Tarefa |
|---|---|
| criada | `WAITING` |
| submetida | `IN_PROGRESS` |
| **aprovada** | **`COMPLETED`**, com `completedAt` |
| **correção solicitada** | **`WAITING`** — volta a esperar o fornecedor |

Aprovar deixava a tarefa aberta para sempre, e ela alimenta `stageProgress` e
`recalculateProject`. Todo projeto que já tinha pedido um documento reportava
progresso menor que a realidade. `reviewDocumentRequest` agora chama
`recalculateProject` ao final.

### Rejeição não é mais terminal — resolvido

`REJECTED` continua sendo o estado no banco; a interface do fornecedor o
apresenta como **"Changes requested"**, com o motivo, um aviso do que precisa
ser feito, e o formulário retitulado "Send a new version".

O reenvio mantém a mesma solicitação, **acrescenta** uma versão sem apagar a
anterior, devolve o status a `SUBMITTED`, reabre a tarefa e notifica a Vionex
com um texto diferente ("enviou uma nova versão").

E o que **não** é mais permitido: reenviar enquanto a Vionex está lendo. Isso
era aceito e deixava o fornecedor trocar o arquivo debaixo do revisor no meio da
decisão.

### Histórico das rodadas — resolvido sem schema

`reviewNote` guarda o veredito **corrente** e é limpo pelo reenvio, o que é
certo para um campo que responde "onde isto está". Era errado como registro: na
sequência rejeita → reenvia → rejeita, o primeiro motivo desaparecia.

Agora **cada nota de revisão também é escrita como uma resposta na conversa da
solicitação** — que é literalmente o que ela é. As rodadas sobrevivem umas às
outras, no lugar onde uma pessoa já lê, sem custar schema.

As respostas passaram a dizer quem escreveu. `DocumentRequestReply.authorId` não
tem foreign key, então os nomes são resolvidos numa consulta à parte
(`resolveReplyAuthors`) que devolve **apenas nome e lado** — um fornecedor
precisa saber se foi a Vionex ou um colega, e nada mais sobre uma conta interna
pertence a essa resposta.

### Notificação com veredito

`"Vionex reviewed your submission."` era idêntica para aprovado e rejeitado.
Agora diz `"Approved."` ou `"Changes requested — please send a new version."`

## PC-4 — o portal deixa de ser um subconjunto

| Tela | O que passou a existir |
|---|---|
| **`/supplier/users`** | lista, adiciona, edita e suspende usuários da própria empresa |
| **`/supplier/tasks`** | o trabalho que a Vionex espera, sem duplicar Pendências |
| **`/supplier/profile`** | nome e cargo editáveis; empresa e papel visíveis e não editáveis |
| **`/supplier/not-found.tsx`** | 404 no idioma do fornecedor, apontando para `/supplier` |

### Tarefas versus Pendências — uma fonte de verdade

Uma solicitação de documento cria uma tarefa espelho. Mostrá-la nas duas telas
seria a mesma pendência em dois lugares — um que a resolve e outro que não.

`listTasks` ganhou `excludeDocumentRequests`, e o portal a usa. A aba de tarefas
mostra o resto, e uma linha abaixo da lista diz onde as solicitações estão.

### Perfil — o que é editável e o que não é

Nome e cargo. **Organização, fornecedor, papel e status não estão no formulário
nem são aceitos pela action** — decidem acesso, e acesso não é autosserviço.

## SUPPLIER_ADMIN — comportamento final

**Pode**, dentro da própria empresa: listar, criar `SUPPLIER_USER` **e
`SUPPLIER_ADMIN`**, editar, suspender, promover e rebaixar.

**Não pode**: alcançar outra empresa, tocar usuário interno, criar papel
interno, promover alguém a papel interno, ou mover alguém entre empresas.

**A empresa é derivada da sessão, nunca recebida do cliente.** `createUser`
preenche `supplierId` a partir de `actor.supplierId`. Uma tentativa explícita de
enviar outro é **recusada** em vez de silenciosamente corrigida — um cliente que
manda a empresa errada tem um bug, e corrigi-lo em silêncio o esconde.

### Proteção contra lockout — implementada

Nenhuma operação pode deixar a empresa sem administrador ativo. Rebaixar ou
suspender o último é recusado.

**Executado em `SERIALIZABLE`**, porque a versão óbvia está errada: dois
administradores se rebaixando ao mesmo tempo leem "dois administradores", ambos
concluem que é seguro, e ambos commitam — `READ COMMITTED`, o padrão do Prisma,
permite exatamente isso. Serializable faz o segundo falhar.

Não exigiu schema nem mecanismo novo: `$transaction` com nível de isolamento já
existe.

### Capacidade verificada no serviço, não só na action

Duas actions chamam `updateUser` e uma terceira chamará. A verificação viver só
numa delas é como uma fronteira deixa de ser fronteira — então o serviço faz a
pergunta por conta própria.

## SCHEMA BLOCKED — PC-5

Uma coisa não coube sem migration.

**Histórico estruturado de revisões.** O texto de cada rodada está preservado
(nas respostas), mas **o veredito de cada rodada, com seu revisor e sua data,
não é consultável como dado**. Responder "quantas vezes este documento foi
rejeitado, por quem e quando" exige `DocumentRequestReview`, que é uma tabela
nova.

**Não improvisei.** Não há JSON, texto concatenado nem campo reaproveitado
carregando isso. O `AuditLog` registra `document.review` com o status, mas **não
guarda a nota**, e consultar auditoria para renderizar produto é uso indevido
daquela tabela.

Continua em [07_SCHEMA_CHANGES_REQUIRED.md](07_SCHEMA_CHANGES_REQUIRED.md),
item 3, aguardando PC-5.

## Timeline e notificações

Nenhuma timeline paralela. Eventos existentes, com `internal` correto —
verificado por teste: **todo evento marcado interno está ausente do que o
fornecedor recebe**.

| Momento | Notificação | Quem |
|---|---|---|
| solicitação criada | `DOCUMENT_REQUESTED` | usuários do fornecedor |
| fornecedor submete | `SUPPLIER_REPLIED` | solicitante + responsável |
| fornecedor reenvia | `SUPPLIER_REPLIED` (texto distinto) | idem |
| revisão | `DOCUMENT_REVIEWED` **com o veredito** | usuários do fornecedor |

## Testes acrescentados

| Arquivo | Testes | Cobre |
|---|---:|---|
| `tests/integration/regulatory-workflow.test.ts` | **13** | o ciclo inteiro: pedir → submeter → recusar reenvio durante análise → correção → reenvio → histórico preservado → autoria → aprovar → tarefa fecha → timeline → notificações |
| `tests/integration/supplier-portal-scope.test.ts` | 7 | tarefas do portal, lista de usuários, downloads |
| `tests/integration/user-management.test.ts` | +6 | promoção, rebaixamento, lockout, capacidade no serviço |

**26 testes novos.** Total: **182** (81 unitários + 101 integração).

## Riscos residuais

| Risco | Situação |
|---|---|
| Histórico estruturado de revisões | **SCHEMA BLOCKED — PC-5** |
| `REGULATORY` perdeu o status da etapa de importação | consequência de `STAGE_MANAGE`, decidida na rodada anterior |
| PERM-1, PERM-2, PERM-4 | **pendentes por decisão sua**, intocadas nesta rodada |
| Anexo em mensagem | PC-5, não implementado, conforme instruído |
