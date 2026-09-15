# 02 — Lacunas do ambiente interno

Prioridade: **P0** fluxo principal quebrado · **P1** necessário para o produto
funcionar · **P2** necessário antes de usuários externos · **P3** melhoria.

## P0

| # | Lacuna | Evidência | Impacto |
|---|---|---|---|
| **I-1** | **Não existe forma de arquivar ou excluir um projeto.** `Project.archivedAt` é filtrado em 4 lugares e **nunca escrito**; `project:archive` e a ação de auditoria `project.archive` são código morto | `scopes.ts`, `permissions.ts`, `audit.ts` | um projeto criado por engano fica no portfólio para sempre, contaminando todos os KPIs do Dashboard e dos Relatórios |
| **I-2** | **Segundo embarque é impossível.** O `ShipmentDialog` de criação vive apenas no ramo `shipments.length === 0` | `projects/[projectId]/import/page.tsx` | um projeto com produção parcelada trava no primeiro embarque |

## P1

| # | Lacuna | Evidência |
|---|---|---|
| **I-3** | **Gestão de equipe é só-entrada** — convida e nunca mais gerencia. Sem promover, rebaixar, suspender ou corrigir. `updateUserAction` existe e tem zero imports | `team/page.tsx` |
| **I-4** | **Fornecedor imutável** — telefone errado, contato que saiu da empresa ou status `BLOCKED` não têm correção pela interface. `updateSupplierAction` órfã | `suppliers/[supplierId]/page.tsx` |
| **I-5** | **Etapas do projeto não são gerenciáveis** — status, progresso e notas só mudam por derivação. Bloquear uma etapa à mão é impossível. `updateStageAction` órfã | `actions/projects.ts` |
| **I-6** | **Marcos são só leitura** — o painel "Próximos marcos" exibe dados que a interface não sabe produzir. `createMilestoneAction` órfã | `projects/[projectId]/page.tsx` |
| **I-7** | **Itens regulatórios e de GTM só editam status** — a criação captura título, órgão, responsável, prazo e notas; a edição aceita apenas `{projectId, itemId, status}`. Um prazo digitado errado é permanente | `actions/stages.ts` |
| **I-8** | **Ícone "Mensagens" do topbar leva a `/projects`** — não existe tela interna de mensagens, e o contador de não-lidas não tem destino | `components/app/topbar.tsx` |
| **I-9** | **Revisão de documento sem download** — o diálogo de revisão tem select e textarea, e nenhum link para o arquivo que está sendo aprovado | `review-request-dialog.tsx` |
| **I-10** | **Sem caixa de entrada de submissões** — o revisor só descobre pela notificação ou entrando no projeto | — |

## P2

| # | Lacuna | Evidência |
|---|---|---|
| **I-11** | **`/regulatory` sem filtro, busca ou paginação**, cortando em 100 silenciosamente | `regulatory/page.tsx` |
| **I-12** | **`/suppliers` sem paginação** — o rodapé só conta | `listSuppliers` |
| **I-13** | **`/team` sem busca, filtro ou paginação** | `listTeam` |
| **I-14** | **Abas do projeto com `perPage: 100` sem paginação** — o serviço trunca e a interface não sinaliza | `projects/[id]/{tasks,documents}` |
| **I-15** | **Metadados de documento imutáveis** — sem renomear, reclassificar, mudar visibilidade ou enviar nova versão | `documents-table.tsx` |
| **I-16** | **Settings é matriz de leitura** e **não checa `settings:manage` no acesso** — um VIEWER vê a matriz inteira de permissões | `settings/page.tsx` |
| **I-17** | **`/regulatory` também só exige `requireInternalUser`** — ao contrário de `/reports`, que redireciona | `regulatory/page.tsx` |
| **I-18** | **16 rotas sem `loading.tsx`** — incluindo **todas** as 9 abas de projeto, que são as mais pesadas | — |

## P3

| # | Lacuna |
|---|---|
| **I-19** | Notificações não cobrem projeto, fornecedor nem equipe — `notify()` só é chamado em tarefas, documentos e mensagens |
| **I-20** | **GTM não registra nada** — nem timeline nem auditoria, ao contrário das outras três etapas |
| **I-21** | `saveShipmentAction` grava timeline e **não** audita |
| **I-22** | `markThreadReadAction` é código morto — o RSC chama o serviço direto |
| **I-23** | Prop morta `suppliers` no `EditProjectDialog` custa um `listSupplierOptions` por render do layout |
| **I-24** | Menu de ações do projeto: todos os itens só navegam |
