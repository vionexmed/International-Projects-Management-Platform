# 03 — Lacunas do Portal do Fornecedor

> O portal está **completo no que mostra e incompleto no que conecta**.

## Isolamento: verificado de novo

Nenhum caminho encontrado em que um fornecedor alcance dados de outro. Os
escopos, as guardas de acesso e a rota de download continuam corretos, e esta
rodada acrescentou um teste que serializa o payload destinado ao fornecedor e
falha se um campo interno aparecer. **Não mexer.**

## Corrigido nesta rodada

| # | Lacuna | Estado |
|---|---|---|
| **S-1** | Campos internos da Vionex (`ProjectStage.notes`, `Project.blockerNote`, `description`, `Milestone.description`) chegavam ao navegador do fornecedor no payload RSC | **corrigido na consulta** + teste de regressão |
| **S-2** | Timeline mostrava upload de documento `INTERNAL_ONLY` (com o nome do arquivo) e tarefas puramente internas | **corrigido nos dois casos inequívocos** |
| **S-3** | O formulário de submissão era apagado quando o envio falhava | **corrigido** |
| **S-4** | Upload sem nenhum sinal de progresso — o botão virava `"…"` | **corrigido** |
| **S-5** | A zona de arquivo ficava com arquivo fantasma após o envio | **corrigido** |
| **S-6** | No celular, o fornecedor **não conseguia sair nem trocar de idioma** | **corrigido** |

## P0

| # | Lacuna | Evidência |
|---|---|---|
| **S-7** | **`portal:manage-users` não tem nenhuma tela no portal.** A permissão existe, a action existe, e o único ponto de entrada é uma página **interna** que o fornecedor nunca alcança. Um SUPPLIER_ADMIN não consegue adicionar, suspender ou listar usuários da própria empresa | `suppliers/[supplierId]/page.tsx` |
| **S-8** | **O ciclo de rejeição não fecha.** Nada devolve a solicitação a `PENDING`. O reenvio sobrescreve `reviewNote` e `submittedAt` — a rejeição anterior desaparece | `reviewDocumentRequest` |

## P1

| # | Lacuna | Evidência |
|---|---|---|
| **S-9** | **Não existe tela de notificações no portal.** O sino calcula não-lidas e leva para Action Required; nada no portal chama `markRead`, então **o ponto vermelho nunca apaga** | `(supplier)/supplier/layout.tsx` |
| **S-10** | **O fornecedor não vê tarefas.** `taskScope` foi escrito para isso e o banco grava `supplierId` — **não há aba nem página** | `supplier-project-tabs.tsx` |
| **S-11** | **Upload avulso do fornecedor é silencioso** — não notifica ninguém na Vionex | `uploadDocument` |
| **S-12** | **Documento compartilhado não notifica o fornecedor** — `DOCUMENT_RECEIVED` é letra morta | `uploadDocument` |
| **S-13** | **Visibilidade é imutável** — só definida na criação; o ramo de update ignora o campo | `services/documents.ts` |
| **S-14** | **Notificação de revisão sem veredito** — texto idêntico para aprovado e rejeitado | `reviewDocumentRequest` |

## P2

| # | Lacuna |
|---|---|
| **S-15** | **Sem tela de perfil** — só senha e idioma num dropdown. Nome, cargo e telefone não são editáveis pelo próprio usuário |
| **S-16** | **Respostas sem autoria** — `request.replies` mostra corpo e data, sem nome nem lado. Numa troca de várias rodadas fica ilegível (exige schema — ver [07](07_SCHEMA_CHANGES_REQUIRED.md)) |
| **S-17** | **Reenvio permitido durante a análise** — `canSubmit` inclui `SUBMITTED` e `IN_REVIEW`, então o fornecedor sobrescreve enquanto a Vionex revisa |
| **S-18** | **Sem nova versão de documento existente** pela interface do portal |
| **S-19** | **Home sem "marcar como lido"** e limitada a 5 itens, sem página completa |
| **S-20** | **Projects sem filtros**, `perPage: 50` sem paginação |
| **S-21** | Sem abrir conversa nova; sem anexo em mensagem (exige schema) |

## P3

| # | Lacuna |
|---|---|
| **S-22** | Timeline duplica eventos na submissão — `DOCUMENT_UPLOADED` e `DOCUMENT_SUBMITTED` para o mesmo ato |
| **S-23** | `addTaskComment` notifica mesmo com `internal: true` — se o assignee for do fornecedor, o comentário interno chega até ele |
| **S-24** | Rodapé com "Privacy policy" e "Terms of use" apontando para o mesmo `mailto:` |
| **S-25** | `STAGE_UPDATED` de etapas internas (clínico, importação) ainda é visível — precisa de decisão de produto |
