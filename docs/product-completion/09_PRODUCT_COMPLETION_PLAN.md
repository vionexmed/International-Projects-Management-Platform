# 09 — Plano de conclusão funcional

> **Nada aqui foi executado.** Estas fases são de **conclusão de produto**, não
> de production readiness — não reutilizam as fases A–P da auditoria anterior,
> que continua válida e vem depois.
>
> Aguardando sua aprovação.

## Princípio

Agrupar por **superfície tocada**, não por prioridade. Duas fases que mexem nos
mesmos arquivos não correm juntas, por mais independentes que pareçam no papel.

E uma observação que muda o formato do plano: **das ~30 lacunas, apenas 3
precisam de migration.** A esmagadora maioria é ligar o que já existe.

---

## PC-0 · Já entregue nesta rodada

Safety mínimo e a UX crítica do fornecedor. Não é uma fase a executar — está
listada para o grafo fazer sentido.

SEC-001, SEC-002, SEC-003, TEN-002 (+ timeline), TEST-001, UX-001, UX-002,
UX-003, UX-012.

---

## PC-1 · Ligar o que já existe — ✅ ENTREGUE em 15/09/2026

**Esforço: pequeno.** O melhor retorno do plano inteiro.

Cinco server actions completas — com permissão, validação e auditoria — não têm
nenhum botão. O trabalho difícil está feito.

| Item | O que fazer |
|---|---|
| **I-3** | Diálogo de edição de membro → `updateUserAction` (papel, status, departamento) |
| **I-4** | Diálogo de edição de fornecedor → `updateSupplierAction`, incluindo o status |
| **I-5** | Controle de etapa → `updateStageAction` (status, progresso, notas) |
| **I-6** | Diálogo de marco → `createMilestoneAction` |
| **I-1** | `archiveProjectAction` (a coluna, a permissão e a ação de auditoria já existem) **+ visão de arquivados e desarquivar** — entregar os dois juntos, senão arquivar é destrutivo do ponto de vista do usuário |
| **I-2** | Botão de novo embarque fora do ramo `length === 0` |

**Banco:** nenhum. **Migration:** não.
**Arquivos:** `src/features/**` (diálogos novos), 4 páginas internas, 1 action nova.
**Risco:** baixo — as actions já são testadas pelo caminho do servidor.
**Testes:** um por action recém-ligada, verificando permissão e efeito.
**Rollback:** reverter o commit.
**Aceite:** nenhuma das 5 actions continua órfã; arquivar e desarquivar funcionam.

---

## PC-2 · Fechar o ciclo regulatório — ✅ ENTREGUE em 15/09/2026

**Esforço: médio.** É o fluxo mais importante do produto e hoje ele abre e não fecha.

| Item | O que fazer |
|---|---|
| **A** | Aprovar um documento **fecha a tarefa espelho** (hoje ela fica aberta para sempre e subestima o progresso do projeto) |
| **B** | Download do arquivo **dentro do diálogo de revisão** — hoje decide-se sem poder abrir |
| **B2** | Uma fila interna de submissões pendentes (pode ser um filtro em `/regulatory`, não precisa de tela nova) |
| **C** | Notificação de revisão diz o veredito |
| **E** | **"Solicitar de novo"** — devolve a solicitação a aberta, preservando a rodada anterior |
| **S-17** | Bloquear reenvio enquanto está `IN_REVIEW` |
| **D** | Um evento de timeline por ato, não dois |

**Banco:** *item E preserva o histórico apenas se houver `DocumentRequestReview`*
— ver PC-5. **Sem ele, "solicitar de novo" funciona e sobrescreve o motivo
anterior.** Recomendo entregar PC-2 sem schema e completar o histórico em PC-5.

**Migration:** não (com a ressalva acima).
**Risco:** médio — mexe na máquina de estados de `RequestStatus`.
**Testes:** o ciclo completo, incluindo rejeitar → pedir de novo → reenviar → aprovar.
**Aceite:** a tarefa espelho fecha; o revisor baixa o arquivo na tela em que decide; `REJECTED` deixa de ser terminal.

---

## PC-3 · Fazer a plataforma avisar — ✅ ENTREGUE em 15/09/2026

**Esforço: médio.** Hoje ela é inteiramente passiva.

| Item | O que fazer |
|---|---|
| **S-11** | Upload avulso do fornecedor notifica a Vionex |
| **S-12** | Documento compartilhado notifica o fornecedor (`DOCUMENT_RECEIVED`) |
| **prazo** | Rota de cron protegida emitindo `TASK_DUE_SOON` e `TASK_OVERDUE`, deduplicando por consulta a `Notification` na janela |
| **S-9** | Tela de notificações no portal, com "marcar como lido" — hoje o ponto do sino nunca apaga |
| **I-19** | Notificar mudanças relevantes de projeto |
| **S-23** | `addTaskComment` deixa de notificar quando `internal: true` |
| **S-25** | Decidir e aplicar `internal: true` no resto da timeline (etapas clínicas e de importação) |

**Banco:** nenhum — os 4 tipos de notificação já existem no enum.
**Migration:** não.
**Atenção:** a rota de cron é a primeira superfície nova exposta. Precisa de
segredo próprio e não deve ser alcançável sem ele.
**Aceite:** nenhum tipo declarado continua sem emissor; o sino apaga.

---

## PC-4 · Completar o portal — ✅ ENTREGUE em 15/09/2026

**Esforço: médio.**

| Item | O que fazer |
|---|---|
| **S-7** | Rota `/supplier/users` — `portal:manage-users` existe e não tem tela |
| **S-10** | Aba de tarefas no portal — `taskScope` já prevê, o banco já grava |
| **S-15** | Tela de perfil: nome, cargo, telefone |
| **S-13** | Mudar visibilidade de documento depois da criação |
| **S-18** | Nova versão de documento pela interface |
| **UX-D** | `not-found.tsx` no portal, em inglês, apontando para `/supplier` |

**Banco:** nenhum. **Migration:** não.
**Risco:** baixo. **Decisão de produto pendente:** um SUPPLIER_ADMIN pode criar
outro SUPPLIER_ADMIN?

---

## PC-5 · Rodada de schema

**Esforço: médio.** **Isolada, de propósito** — é a única com migration.

| # | Mudança | Destrava |
|---|---|---|
| 1 | `MessageAttachment` | anexo em mensagem |
| 2 | `DocumentRequestReply.author` (FK) | quem escreveu cada resposta |
| 3 | `DocumentRequestReview` | histórico de rodadas; completa PC-2 |

**Banco: sim.** Três migrations aditivas.
**Pré-condição:** a mudança 2 **falha** se houver `authorId` órfão — verificar antes.
**Nota de sequência:** a auditoria de produção pede backup e restore validados
antes de qualquer migration. Em desenvolvimento isso não se aplica; **quando
esta fase alcançar um banco com dado real, aplica-se.**
**Aceite:** as três migrations aplicadas em desenvolvimento, com rollback escrito.

---

## PC-6 · Acabamento e permissões

**Esforço: médio.**

| Item | O que fazer |
|---|---|
| **PERM-1..4** | As quatro divergências, **após sua decisão** |
| **UX-A** | Paginação nas 5 telas que truncam em silêncio |
| **UX-B** | `loading.tsx` nas 16 rotas de detalhe |
| **UX-C** | As três afordâncias que mentem |
| **I-7** | Editar item regulatório e de GTM por inteiro, não só o status |
| **I-15** | Metadados de documento editáveis |
| **I-16/17** | `/settings` e `/regulatory` checam permissão |
| **I-20/21** | GTM e embarque gravam timeline e auditoria |
| **I-11..14** | Busca, filtro e paginação em `/regulatory`, `/suppliers`, `/team` |

**Banco:** nenhum. **Migration:** não.

---

## Grafo

```
PC-0 (feito)
   │
   ├──► PC-1  ligar o que existe        ─┐
   │                                     │  superfícies disjuntas
   ├──► PC-3  notificações              ─┤  → podem correr juntas
   │                                     │
   └──► PC-4  completar o portal        ─┘
            │
            ▼
         PC-2  fechar o ciclo regulatório
            │
            ▼
         PC-5  schema (isolada)
            │
            ▼
         PC-6  acabamento + permissões
```

### Por que essa ordem

- **PC-1 e PC-3 não se encostam.** PC-1 é `src/features/**` e páginas internas;
  PC-3 é `src/server/services/**` e uma rota nova. Nenhum arquivo em comum.
- **PC-4 toca `(supplier)/**`**, que nenhuma das outras duas toca.
- **PC-2 depende de PC-3** para a notificação com veredito, e de PC-1 para a
  tarefa espelho (que é edição de tarefa).
- **PC-5 sozinha**, porque é a única com migration. Se algo der errado, a causa
  precisa ser inequívoca.
- **PC-6 por último** porque PERM-1..4 mudam comportamento de usuários reais e
  ficam melhor sobre um produto já estável.

## Rodadas

| Rodada | Fases | Esforço | Blast radius |
|---|---|---|---|
| ~~1~~ | ~~**PC-1 + PC-3**~~ | ~~pequeno + médio~~ | **✅ entregue** — ver [11](11_PC1_PC3_DELIVERY.md) |
| ~~2~~ | ~~PC-4~~ | ~~médio~~ | **✅ entregue** — ver [12](12_PC2_PC4_DELIVERY.md) |
| ~~3~~ | ~~PC-2~~ | ~~médio~~ | **✅ entregue** — ver [12](12_PC2_PC4_DELIVERY.md) |
| **4** | **PC-5 isolada** | médio | **o maior** — única com migration |
| **5** | PC-6 | médio | médio — muda permissões de usuários reais |

## O caminho mais curto — atualizado

A Rodada 1 foi entregue. O placar saiu de 14 completas para 22, e as
funcionalidades quebradas foram a zero.

**A próxima é PC-2.** É o único P0 que resta e é o fluxo mais importante do
produto: hoje a Vionex rejeita um documento e não existe ação que peça de novo,
e aprovar um documento deixa a tarefa espelho aberta para sempre — distorcendo o
progresso de todo projeto que já teve uma solicitação.

**PC-2 e PC-4 podem correr juntas.** PC-2 vive em `services/documents.ts` e na
aba regulatória interna; PC-4 vive em `(supplier)/**` e cria rotas novas. Não
compartilham arquivo. A única atenção é que ambas mexem em documentos: PC-2 no
ciclo de revisão, PC-4 na visibilidade e no versionamento — bordas diferentes do
mesmo serviço, o que pede que a segunda a integrar rode os testes da primeira.
