# 01 — Inventário de funcionalidades

**COMPLETA** · **PARCIAL** · **SÓ VISUAL** (mostra dados, nenhuma ação funciona) ·
**QUEBRADA** · **INCONSISTENTE** · **AUSENTE**

## Ambiente interno

| # | Área | Veredito | O que falta |
|---|---|---|---|
| 1 | Dashboard | **COMPLETA** | — (painel de leitura, por design) |
| 2 | Projects (lista) | **COMPLETA** | arquivar (ver 3) |
| 3 | Project Overview | **PARCIAL** | etapas e marcos são só leitura; sem arquivar; sem `loading.tsx` |
| 4 | Clinical | **COMPLETA** | — |
| 5 | Regulatory (projeto) | **PARCIAL** | item regulatório só edita status — título, órgão e prazo ficam imutáveis |
| 6 | Regulatory (portfólio) | **SÓ VISUAL** | sem filtro, sem busca, sem paginação; corta em 100 sem avisar |
| 7 | Import & Logistics | **PARCIAL / QUEBRADA** | **o botão de novo embarque só aparece quando não há nenhum** |
| 8 | Go-to-Market | **PARCIAL** | só edita status; **não grava timeline nem auditoria** |
| 9 | Tasks (lista) | **COMPLETA** | — |
| 10 | Task Detail | **COMPLETA** | — |
| 11 | Documents | **PARCIAL** | metadados imutáveis: sem renomear, reclassificar, mudar visibilidade ou nova versão |
| 12 | Suppliers (lista) | **PARCIAL** | sem paginação |
| 13 | Supplier Profile | **PARCIAL** | **nada é editável** — só criar usuário do portal |
| 14 | Team | **PARCIAL** | convida e nunca mais gerencia; sem busca, filtro ou paginação |
| 15 | Reports | **COMPLETA** | sem recorte por período/projeto |
| 16 | Notifications | **COMPLETA** | — |
| 17 | Settings | **SÓ VISUAL** | **nada é editável**; e um VIEWER vê a matriz inteira de permissões |

## Portal do fornecedor

| # | Tela | Veredito | O que falta |
|---|---|---|---|
| 18 | Home | **PARCIAL** | sem "marcar como lido" — o ponto do sino nunca apaga |
| 19 | Projects | **COMPLETA** | sem filtros; `perPage: 50` sem paginação |
| 20 | Project Overview | **COMPLETA** | — |
| 21 | Tab Documents | **PARCIAL** | sem enviar nova versão de um documento existente |
| 22 | Tab Action Required | **COMPLETA** | — |
| 23 | Tab Messages | **COMPLETA** | sem anexo, sem abrir conversa nova |
| 24 | Tab Timeline | **INCONSISTENTE** | ver 06 — parcialmente corrigido nesta rodada |
| 25 | Action Required (global) | **COMPLETA** | — |
| 26 | Request Detail | **PARCIAL** | respostas sem autor; não diz que a nota é motivo de rejeição |
| 27 | Documents (global) | **COMPLETA** | — |
| 28 | Messages (global) | **COMPLETA** | — |
| 29 | **Notificações** | **AUSENTE** | não existe rota; o sino leva para Action Required |
| 30 | **Perfil** | **AUSENTE** | só senha e idioma num dropdown; nome e cargo não editáveis |
| 31 | **Usuários do fornecedor** | **AUSENTE** | `portal:manage-users` existe e **não tem nenhuma tela no portal** |
| 32 | **Tarefas** | **AUSENTE** | `taskScope` prevê, o banco grava, **e não há tela** |

## Capacidades ausentes no interno

| # | Capacidade | Evidência |
|---|---|---|
| 33 | **Arquivar projeto** | `Project.archivedAt` é filtrado em 4 lugares e **nunca escrito**; `project:archive` e a ação de auditoria `project.archive` são código morto |
| 34 | **Editar membro da equipe** | `updateUserAction` existe, zero imports |
| 35 | **Editar fornecedor** | `updateSupplierAction` existe, zero imports |
| 36 | **Editar etapa do projeto** | `updateStageAction` existe, zero imports |
| 37 | **Criar marco** | `createMilestoneAction` existe, zero imports |
| 38 | **Notificação de prazo** | `TASK_DUE_SOON` / `TASK_OVERDUE` no enum, nunca emitidos; sem agendador |
| 39 | **Tela interna de mensagens** | o ícone do topbar aponta para `/projects` |

## Controles que prometem e não cumprem

| Controle | Promete | Faz |
|---|---|---|
| Ícone "Mensagens" do topbar | caixa de mensagens | navega para `/projects` |
| Sino do portal | notificações | navega para `/supplier/action-required` |
| Menu do projeto → "Solicitar documento" | abrir o diálogo | só navega para a aba |
| Menu do projeto → "Enviar documento" | abrir o upload | só navega para a aba |
| `EditProjectDialog` prop `suppliers` | trocar o fornecedor | **nunca renderizada** — e custa um `listSupplierOptions` por render |
| Badge de status do fornecedor | estado gerenciável | só leitura |
| Rodapé do portal: "Privacy policy" / "Terms of use" | páginas | dois `mailto:` iguais |

## Contagem

| Veredito | Início | PC-1+PC-3 | **PC-2+PC-4** |
|---|---:|---:|---:|
| **COMPLETA** | 14 | 22 | **29** |
| **PARCIAL** | 12 | 9 | **4** |
| **SÓ VISUAL** | 3 | 2 | **2** |
| **INCONSISTENTE** | 1 | 0 | **0** |
| **AUSENTE** | 8 | 3 | **0** |
| **QUEBRADA** | 3 | 0 | **0** |

### O que mudou nesta rodada

| Item | De | Para |
|---|---|---|
| Regulatory (projeto) | PARCIAL | **COMPLETA** — revisão com download, ciclo que fecha |
| Request Detail (portal) | PARCIAL | **COMPLETA** — correção, reenvio, autoria nas respostas |
| Tab Documents (portal) | PARCIAL | **COMPLETA** — nova versão via reenvio da solicitação |
| **Usuários do fornecedor** | AUSENTE | **COMPLETA** |
| **Tarefas no portal** | AUSENTE | **COMPLETA** |
| **Perfil do fornecedor** | AUSENTE | **COMPLETA** |

### Parciais que restam

| Item | O que falta | Fase |
|---|---|---|
| Regulatory (portfólio) | filtro, busca, paginação | PC-6 |
| Suppliers (lista) | paginação | PC-6 |
| Documents (interno) | renomear, reclassificar, mudar visibilidade | PC-6 |
| Notificação de prazo | varredura periódica (agendador) | fora de escopo |

### Só visuais que restam

Settings (nada editável) e `/regulatory` no portfólio. Ambos em **PC-6**.

### O que mudou de veredito

| Item | De | Para |
|---|---|---|
| Project Overview | PARCIAL | **COMPLETA** — etapas editáveis, marcos criáveis |
| Import & Logistics | PARCIAL/QUEBRADA | **COMPLETA** — segundo embarque possível |
| Suppliers (lista) | PARCIAL | PARCIAL — ainda sem paginação |
| Supplier Profile | PARCIAL | **COMPLETA** — editável, incluindo status |
| Team | PARCIAL | **COMPLETA** — convida e gerencia |
| Home do portal | PARCIAL | **COMPLETA** — notificações com "marcar como lida" |
| Tab Timeline | INCONSISTENTE | **COMPLETA** — eventos internos filtrados |
| Notificações do portal | AUSENTE | **COMPLETA** |
| Arquivar projeto | AUSENTE | **COMPLETA** |
| Editar membro / fornecedor / etapa, criar marco | AUSENTE | **COMPLETA** |
| Notificação de prazo | AUSENTE | **PARCIAL** — orientada a evento; varredura periódica depende de agendador |
| Ícone "Mensagens" do topbar | QUEBRADA | QUEBRADA — **continua apontando para `/projects`** (PC-6) |
| Sino do portal | QUEBRADA | **COMPLETA** |

### Ausentes que restam

| # | Capacidade | Fase |
|---|---|---|
| 31 | Usuários do fornecedor — UI no portal (o servidor já aplica a regra) | **PC-4** |
| 32 | Tarefas no portal | **PC-4** |
| 30 | Perfil do fornecedor | **PC-4** |
