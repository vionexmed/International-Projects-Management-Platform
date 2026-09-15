# Permissões — estado final

Matriz aplicada no servidor, em `src/server/authz/permissions.ts`, verificada
por 93 testes unitários e pelos testes de integração que exercitam os serviços
de escrita.

## Princípio

Três perguntas diferentes, três camadas:

| Pergunta | Onde é respondida |
|---|---|
| Este usuário **pode** fazer isto? | capacidade (`roleHas` / `assertRoleCan`) |
| Esta linha é **dele**? | escopo (`scopes.ts`, dentro da query) |
| Este documento é **da área dele**? | domínio (`canReviewDocumentType`) |

Nenhuma delas é respondida escondendo elemento na interface.

## Matriz por papel

| Capacidade | ADMIN | MANAGER | REGULATORY | IMPORT | MARKETING | VIEWER | SUP_ADMIN | SUP_USER |
|---|---|---|---|---|---|---|---|---|
| project:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| project:create | ✓ | ✓ | ✓ | — | — | — | — | — |
| **project:update** | ✓ | ✓ | — | — | — | — | — | — |
| project:archive | ✓ | ✓ | — | — | — | — | — | — |
| task:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| task:create / update | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| document:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| document:upload | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| document:request | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| **document:review** | ✓ | ✓ | ✓* | ✓* | ✓* | — | — | — |
| clinical:manage | ✓ | ✓ | ✓ | — | — | — | — | — |
| regulatory:manage | ✓ | ✓ | ✓ | — | — | — | — | — |
| import:manage | ✓ | ✓ | — | ✓ | — | — | — | — |
| gtm:manage | ✓ | ✓ | — | — | ✓ | — | — | — |
| supplier:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| supplier:manage | ✓ | ✓ | — | — | — | — | — | — |
| message:send | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| report:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| team:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| user:manage | ✓ | — | — | — | — | — | — | — |
| settings:manage | ✓ | — | — | — | — | — | — | — |
| portal:access | ✓ | — | — | — | — | — | ✓ | ✓ |
| portal:manage-users | ✓ | — | — | — | — | — | ✓ | — |

`*` restrito pelo domínio do documento — ver PERM-2.

## PERM-1 — `project:update`

**Resolvido.** Editar o projeto (nome, datas, responsável, status, nota de
bloqueio) é *conduzir* o projeto, e ficou com **ADMIN e MANAGER**. Antes todo
especialista tinha, o que permitia o Marketing reescrever a nota de bloqueio de
um projeto regulatório.

Cada especialista continua editando **a sua etapa**, pela capacidade de domínio
que já existia (`STAGE_PERMISSION`). Nada foi inventado: a separação já estava
declarada, só não era aplicada aqui.

Marco de etapa segue o dono da etapa; marco que atravessa o projeto exige
`project:update`.

**Questão deixada explícita, não resolvida em silêncio:** `REGULATORY` mantém
`project:create`. Criar continua permitido, editar depois não. Se a Vionex
preferir que só ADMIN/MANAGER criem projetos, é uma linha em
`ROLE_PERMISSIONS` — mas é uma decisão de produto, e não foi tomada aqui.

## PERM-2 — `document:review`

**Resolvido por domínio**, com fail-closed no que não é classificável.

| Tipo de documento | Quem decide |
|---|---|
| CERTIFICATE, IFU, REGULATORY | `regulatory:manage` |
| CLINICAL | `clinical:manage` |
| IMPORT | `import:manage` |
| COMMERCIAL, PRESENTATION | `gtm:manage` |
| **CONTRACT, NDA, OTHER** | **somente ADMIN e MANAGER** |

Os três últimos não identificam área. O produto **não adivinha**: uma aprovação
é exatamente aquilo em que uma pasta regulatória precisa poder confiar, e um
palpite errado a assina com autoridade que não existe.

Aplicado em `reviewDocumentRequest`, **no serviço** — o tipo da solicitação só
é conhecido depois de lê-la, então a action não teria como decidir, e uma
verificação que mora num único chamador não é regra, é hábito.

## PERM-4 — `VIEWER`

**Resolvido.** `VIEWER` é funcionário interno da Vionex, somente leitura.

**Pode ler:** projetos a que tem acesso, tarefas, documentos — **inclusive
`INTERNAL_ONLY`** —, timeline interna, relatórios.

`INTERNAL_ONLY` significa *"não visível ao fornecedor"*. Nunca significou
"restrito a funcionários juniores", e ler assim tornaria o papel inútil para o
único público que ele serve.

**Não pode:** criar, editar, arquivar, enviar documento, solicitar, revisar,
aprovar, atribuir, comentar, mandar mensagem, gerir usuários ou configurações.

## Correção estrutural desta rodada

As capacidades eram verificadas apenas nas server actions. Os serviços
confiavam no chamador — e escopo responde "de quem é esta linha", nunca "você
pode alterá-la". Um `VIEWER` chegando a `createTask` por qualquer outro caminho
criava a tarefa.

`assertRoleCan` passou a ser chamado dentro de `createTask`, `updateTask`,
`addTaskComment`, `uploadDocument`, `createDocumentRequest` e `sendMessage`.
Descoberto por teste, não por leitura.
