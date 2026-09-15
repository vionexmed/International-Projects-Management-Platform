# 12 — Governança de dados

## Classificação dos dados

| Classe | O que | Onde | Quem acessa |
|---|---|---|---|
| **RESTRICTED** | `User.passwordHash` | `User` | ninguém — só `signIn` compara |
| **RESTRICTED** | Documentos: contratos, NDAs, dossiês regulatórios, certificados | storage + `DocumentVersion` | internos com `document:read`; fornecedor só o que é `SHARED_WITH_SUPPLIER` do próprio projeto |
| **CONFIDENTIAL** | `ProjectStage.notes`, `Project.blockerNote`, `Project.description` | `Project`, `ProjectStage` | deveria ser só interno — **hoje chega ao fornecedor** (TEN-002) |
| **CONFIDENTIAL** | Mensagens entre Vionex e fornecedor | `Message` | as duas partes da thread |
| **CONFIDENTIAL** | Dados de contato do fornecedor (`email`, `phone`, `address`) | `Supplier` | internos |
| **CONFIDENTIAL** | `AuditLog` | — | **ninguém — não há tela de leitura** |
| **INTERNAL** | Projetos, tarefas, marcos, etapas | — | internos; fornecedor só os próprios |
| **INTERNAL** | `User.email`, `name`, `jobTitle`, `lastLoginAt` | `User` | internos com `team:read` |
| **PUBLIC** | nada | — | — |

## Dados pessoais

Sob LGPD e GDPR, são dados pessoais: `User.name`, `User.email`, `User.jobTitle`,
`User.department`, `User.lastLoginAt`, `Supplier.primaryContact`,
`Supplier.email`, `Supplier.phone`, `LoginAttempt.key` (que contém e-mail **e
endereço IP**), e `AuditLog.actorId` com `createdAt`.

Titulares em múltiplas jurisdições: Brasil (LGPD), Alemanha e Itália (GDPR),
Estados Unidos, China (PIPL).

**Nenhuma avaliação jurídica é feita aqui.** Os pontos abaixo são requisitos
**técnicos** que costumam acompanhar essas normas. Cada um marcado
**LEGAL REVIEW REQUIRED**.

## GOV-D1 — Não existe caminho técnico de exclusão · **HIGH** · LEGAL REVIEW REQUIRED

Três fatos somados:

1. **A aplicação nunca apaga nada.** As únicas chamadas de exclusão em todo
   `src/` são `loginAttempt.deleteMany` e a remoção do cookie. Não há
   `user.delete`, `document.delete`, `project.delete`.
2. **Seis FKs `Restrict`** garantem que qualquer usuário com histórico **jamais**
   possa ser excluído do banco: `Project.ownerId`, `Task.createdById`,
   `Document.createdById`, `DocumentVersion.uploadedById`,
   `DocumentRequest.requestedById`, `Project.supplierId`.
3. **`storage().delete()` existe no driver e nenhum código o chama.** Nenhum
   arquivo é removido, nunca.

Um pedido de exclusão sob GDPR ou LGPD hoje **não tem resposta técnica**. Só
existe `UserStatus.SUSPENDED`.

A decisão a tomar — e é de negócio e jurídica, não de engenharia — é entre
**anonimização no lugar** (preservando a cadeia de custódia regulatória, que é
provavelmente a obrigação concorrente) e **exclusão real**.

## GOV-D2 — Nenhuma política de retenção · **MEDIUM** · LEGAL REVIEW REQUIRED

`DocumentVersion` guarda todas as versões para sempre. `AuditLog` cresce sem
limite. `Message` idem. `LoginAttempt` — que contém IP, dado pessoal — é limpo
de forma **probabilística** (`if (Math.random() < 0.05)`), o que funciona mas não
é uma política.

Nenhuma decisão registrada sobre por quanto tempo cada classe de dado é guardada.
Para dossiês regulatórios de dispositivos médicos, o prazo é provavelmente
regido por norma — e pode ser longo.

## GOV-D3 — Arquivos órfãos são dados fora de governança · **MEDIUM**

STO-001: quando a transação falha após a escrita no storage, o arquivo permanece
sem nenhuma linha que o referencie. **Não há como encontrá-lo, listá-lo ou
apagá-lo.** Um documento que o usuário acredita não ter enviado continua
existindo, fora de qualquer inventário.

## GOV-D4 — A trilha de auditoria não é confiável como trilha · **HIGH**

Quatro problemas somados:

1. **Perde entradas em silêncio.** `recordAudit` engole toda falha. Numa
   indisponibilidade do banco, operações são realizadas e não auditadas, e a
   única evidência é stdout — que ninguém lê (OPS-001).
2. **Nenhuma leitura.** Zero referências a `auditLog.` em `src/app/`,
   `src/features/`, `src/components/`. Não há tela, filtro nem export.
3. **Sem proteção no banco.** Sem trigger, sem `REVOKE UPDATE, DELETE`, sem role
   separada. A aplicação conecta com credenciais plenas.
4. **`actorId onDelete: SetNull`** — se um usuário for removido por qualquer
   caminho externo, as entradas **perdem a atribuição**, mantendo ação e
   timestamp. "Alguém aprovou este certificado" não é auditoria.
   E **`organizationId onDelete: Cascade`** destrói a trilha inteira.

## O que já está certo

| Ponto | Evidência |
|---|---|
| Cobertura de ações razoável | 21 ações registradas, incluindo `auth.login`, `auth.logout`, `document.download`, `user.role_change` com metadata `{from, to}` |
| **Download de documento é auditado** | `src/app/api/files/[versionId]/route.ts` — raro e correto |
| Nenhuma exclusão na aplicação | reduz muito o risco de perda acidental |
| Chaves de storage imprevisíveis e namespaced por organização | `buildStorageKey` |
| `AuditLog` sem `updatedAt` | sinaliza intenção append-only |

## Lacunas de auditoria

| Ação | Registrada? |
|---|---|
| Login por `/demo/enter` | **não** — a rota chama `createSessionToken` sem `recordAudit` |
| Login **falho** | **não** — só conta em `LoginAttempt`, sem ator, e é purgado |
| Exportação de CSV do portfólio inteiro | **não** |
| Troca de idioma | não |
| Arquivamento de projeto | `project.archive` está declarado e **nunca é emitido**; `Project.archivedAt` existe e nada o escreve |
