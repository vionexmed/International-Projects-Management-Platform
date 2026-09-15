# Product Functional Freeze — Vionex Projects

**Data:** 15 de setembro de 2026
**Rodada:** PC-6B (última rodada funcional)
**Baseline:** `72bc330` (PC-6A)

---

## Decisão

# PRODUCT FUNCTIONAL FREEZE: YES

A plataforma está funcionalmente completa. Nenhum workflow core está quebrado,
nenhuma feature core está ausente, nenhuma página core finge funcionar, as
permissões estão coerentes, o isolamento entre fornecedores está íntegro e
nenhum dado interno vaza para o portal.

A partir daqui, mudança funcional deixa de ser prioridade. O próximo trabalho é
produtionização — banco gerenciado, storage, segredos, CI, staging, produção —
descrito em `05_PRODUCTIONIZATION_HANDOFF.md`.

## O que é a plataforma

Duas experiências sobre um banco:

- **Vionex Internal** (`/dashboard`, pt-BR) — o portfólio de projetos com
  fabricantes na China, Alemanha, EUA e Itália, em quatro etapas: clínico,
  regulatório, importação e go-to-market.
- **Supplier Portal** (`/supplier`, en/pt/zh) — o que a Vionex precisa de cada
  fabricante, e nada além disso.

A invariante que governa tudo: **um fornecedor nunca vê o dado de outro, e isso
é garantido no servidor, dentro da query, nunca escondendo elemento na tela.**

## O caminho até aqui

| Rodada | Entrega |
|---|---|
| PC-1 | Ligar o que já existia — ações órfãs, arquivamento, telas sem escrita |
| PC-2 | Fechar o ciclo regulatório — decisão, correção, reenvio, aprovação |
| PC-3 | Fazer a plataforma avisar — dez tipos de notificação, ao público certo |
| PC-4 | Completar o Supplier Portal — tarefas, usuários, documentos, escopo |
| PC-5 | Modelo de dados — histórico de análise e anexo de mensagem (1 migration) |
| PC-6A | Arquitetura de informação — cada tela com uma pergunta |
| PC-6B | Permissões, fake UI, consistência, datas, freeze |

## Estado final

| | |
|---|---|
| Telas | 36 (21 internas, 15 do portal) |
| COMPLETE | 57 |
| PARTIAL | 2 (declarados) |
| VISUAL_ONLY / MISSING / BROKEN | **0 / 0 / 0** |
| FUTURE | 5 (produtionização) |
| Testes | **253** — 93 unit, 160 integration |
| Failures / skips | **0 / 0** |
| lint · typecheck · build | limpos |
| Migrations | 3, nenhuma histórica alterada |

## O que PC-6B corrigiu

Cinco achados reais, nenhum cosmético:

1. **Capacidade não era verificada nos serviços.** As server actions checavam;
   os serviços confiavam no chamador. Um `VIEWER` chegando a `createTask` por
   qualquer outro caminho criava a tarefa — escopo responde "de quem é esta
   linha", nunca "você pode alterá-la". Descoberto por teste.
2. **`daysUntil` comparava meia-noite local com data guardada em UTC.** Todo
   prazo com vencimento hoje aparecia como *"1 dia atrasado"* para qualquer
   usuário em fuso negativo — ou seja, para toda a equipe brasileira, o dia
   inteiro, todos os dias.
3. **`project:update` era amplo** — Marketing podia reescrever a nota de
   bloqueio de um projeto regulatório (PERM-1).
4. **`document:review` era plano** — quem aprovava um certificado de análise
   também aprovava uma fatura de importação (PERM-2).
5. **Duas listas truncavam em silêncio** — documentos do portal e a fila
   regulatória cortavam em 100 e 25 sem paginador. Quem não achasse um arquivo
   não tinha como saber se ele não existe ou se está além de um limite
   invisível.

## O que PC-6B deliberadamente não fez

Nenhuma feature nova. Nenhuma migration. Nenhuma configuração de Supabase,
staging ou produção. `DATABASE_URL` de produção não existe e não foi criada.
Nenhum passo de produtionização foi iniciado.

## Confirmações

- Nenhuma migration nova criada nesta rodada.
- As três migrations históricas estão intactas.
- Supabase não configurado.
- `DATABASE_URL` de produção não alterada (não existe).
- Staging não criado.
- Produção não alterada.
- Produtionização não iniciada.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| `00_PRODUCT_FREEZE_REPORT.md` | este |
| `01_FINAL_FEATURE_MATRIX.md` | classificação item a item |
| `02_FINAL_WORKFLOWS.md` | os três fluxos ponta a ponta |
| `03_FINAL_PERMISSIONS.md` | matriz e PERM-1/2/4 |
| `04_REMAINING_NON_PRODUCTION_GAPS.md` | o que sobrou dentro do escopo |
| `05_PRODUCTIONIZATION_HANDOFF.md` | o mapa para quem for pôr no ar |
| `IA_SCREEN_RESPONSIBILITIES.md` | uma pergunta por tela |
