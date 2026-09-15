# Arquitetura de informação — responsabilidade de cada tela

PC-6A. Cada tela responde **uma** pergunta. Quando duas respondiam a mesma, uma
virou resumo, agregação ou preview — nenhuma foi simplesmente apagada.

## Semântica do produto

| Termo | Significa |
|---|---|
| **Action Required** | algo que o usuário precisa **fazer** |
| **Notification** | algo **aconteceu** e ele precisa **saber** |
| **Timeline** | registro histórico do que **aconteceu** |
| **Report** | análise **agregada** dos dados |
| **Dashboard** | o que precisa de **atenção agora** |
| **Overview** | **estado atual** de uma entidade |
| **List page** | fonte **canônica** para localizar e operar várias entidades |

## Fontes canônicas

`/projects` · `/tasks` · `/regulatory` · `/documents` · `/suppliers` · `/reports` ·
`/notifications` · Project → Timeline · Supplier → Action Required.

Nenhuma outra tela recria essas listas completas.

## Regra de repetição

Uma tabela completa não deve aparecer em várias páginas com as **mesmas colunas,
a mesma query, o mesmo objetivo e as mesmas ações**. Para mostrar a mesma
informação em outro lugar: resumo, agregado, preview, exceções, *View all*, ou
deep link com filtro.

---

## Ambiente interno (Vionex)

| Tela | Pergunta principal | Dado principal | Ação principal | Canônica de | Duplicava | Decisão |
|---|---|---|---|---|---|---|
| `/dashboard` | O que precisa da minha atenção agora? | exceções + KPIs + prazos | abrir a exceção | — | `/projects` (tabela idêntica), `/suppliers` (lista de pendências) | **Reescrita.** Virou triagem: KPIs clicáveis, *Precisa da sua atenção*, prazos, distribuição por etapa. Nenhuma lista canônica. |
| `/projects` | Quais projetos existem e como estão? | portfólio | abrir / criar projeto | projetos | — | **Mantida e reforçada.** Nova aba *Precisam de atenção*; filtros de fornecedor, responsável, etapa, país; busca, paginação, arquivados. |
| `/projects/[id]` (Overview) | Como este projeto está agora? | estado atual | editar etapa / marco | — | aba Timeline (8 eventos) | **Reduzida.** Atividade recente virou preview de 3 + *ver histórico completo*. |
| `/projects/[id]/timeline` | O que aconteceu neste projeto? | histórico completo | ler | histórico do projeto | — | Mantida. |
| `/projects/[id]/{clinical,regulatory,import,go-to-market,tasks,documents,messages}` | Como está **este** recorte **deste** projeto? | dados da etapa | operar a etapa | — | — | Mantidas. Recorte project-scoped legítimo. |
| `/tasks` | Qual é o trabalho operacional interno? | tarefas | operar tarefa | tarefas | — | Mantida. Deep link `?tab=OVERDUE`. |
| `/regulatory` | Como está o regulatório do portfólio? | solicitações + itens | revisar | regulatório global | — | **Mantida + filtros.** `?status=open|supplier|review|overdue|all`, destino dos drill-downs. |
| `/documents` | Onde está o arquivo? | repositório | baixar | documentos | — | Mantida. |
| `/suppliers` | Quem são os fornecedores? | diretório | abrir fornecedor | fornecedores | — | Mantida. |
| `/suppliers/[id]` | Qual é a situação deste fornecedor? | perfil + métricas | editar / gerir usuários | — | `/projects` (mesma tabela filtrada) | **Reduzida.** Projetos viraram resumo de 5 linhas + *Ver em Projetos* (`?supplier=`). |
| `/reports` | O que os dados da operação estão dizendo? | agregações | analisar / exportar | analytics | `/projects` e `/suppliers` (listas inteiras) | **Reescrita.** Só contagens, distribuições e médias, cada número com drill-down. Zero linhas de projeto. |
| `/notifications` | O que aconteceu que eu preciso saber? | eventos | ler / abrir origem | notificações | — | Mantida. |
| `/team`, `/settings` | Quem tem acesso / como configuro? | contas e preferências | administrar | — | — | Mantidas. |

## Supplier Portal

| Tela | Pergunta principal | Dado principal | Ação principal | Canônica de | Duplicava | Decisão |
|---|---|---|---|---|---|---|
| `/supplier` (Home) | Qual é a minha situação agora? | contagem + próximo prazo + projetos + updates | ir para Action Required | — | Action Required | **Reescrita como resumo.** Quantidade pendente, próximo prazo, 4 projetos, 4 updates — nenhuma lista operável. |
| `/supplier/action-required` | O que a Vionex precisa de mim? | fila única (documentos + tarefas) | responder | pendências do fornecedor | `/supplier/tasks` | **Unificada.** Um item por pendência, com tipo (*Document* / *Task*) e filtros *Tudo / Documentos / Tarefas*. |
| `/supplier/action-required/[id]` | O que exatamente foi pedido? | solicitação + histórico | enviar arquivo | — | — | Mantida. |
| `/supplier/tasks` | — | — | — | — | Action Required | **Redirect 307** → `/supplier/action-required?type=task`. Rota preservada por causa de deep links já enviados. |
| `/supplier/projects` | Quais são meus projetos? | projetos do fornecedor | abrir projeto | projetos do fornecedor | — | Mantida. |
| `/supplier/projects/[id]` | Como está este projeto? | etapas + marcos | acompanhar | — | — | Mantida (já era resumo). |
| `/supplier/documents` | Onde estão meus arquivos? | documentos compartilhados | baixar | documentos do fornecedor | — | Mantida. |
| `/supplier/messages` | O que estamos conversando? | threads | responder / anexar | mensagens | — | Mantida. |
| `/supplier/notifications` | O que aconteceu? | eventos | ler | notificações | — | Mantida, fora do menu principal (acessível pelo sino). |
| `/supplier/profile`, `/supplier/users` | Meus dados / minha equipe | conta e usuários | editar | — | — | Mantidas, na área de conta. `users` só para `SUPPLIER_ADMIN`. |

## Global × project-scoped

Continuam sendo perspectivas diferentes, não duplicação: `/regulatory` × Project ·
Regulatory, `/documents` × Project · Documents, `/tasks` × Project · Tasks. A
diferença é o eixo — **todos os projetos** contra **um projeto**.

## Sem pendência duplicada

Uma `DocumentRequest` com `createTask: true` grava uma tarefa-espelho interna.
Ela é a **mesma** pendência. Por isso é excluída em três lugares:
`listSupplierQueue`, `listAttentionItems` e `countAttentionItems`
(`requests: { none: {} }`). O fornecedor e a Vionex veem a solicitação — que
pode ser resolvida — e nunca o espelho, que não pode.

## Navegação final

**Interna:** Dashboard · Projetos · Tarefas · Regulatório · Documentos ·
Fornecedores · Relatórios · Notificações · Equipe · Configurações.

**Portal:** Home · Projects · Action Required · Documents · Messages.
Na conta: Profile · Users (só `SUPPLIER_ADMIN`). Notifications pelo sino.

## Deep links validados

`/projects?tab=ATTENTION` · `?tab=BLOCKED` · `?tab=ON_TRACK` · `?tab=AT_RISK` ·
`?stage=…` · `?country=…` · `?supplier=…` · `/tasks?tab=OVERDUE` ·
`/regulatory?status=overdue|review|supplier|all` ·
`/supplier/action-required?type=document|task` · `/supplier/tasks` → 307.
