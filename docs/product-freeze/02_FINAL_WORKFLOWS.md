# Workflows finais

Três fluxos ponta a ponta, cada um coberto por teste de integração contra
Postgres real. Onde há "verificado", há asserção — não leitura de código.

## 1. Interno: do login ao arquivamento

`login → Dashboard → Projects → criar/abrir projeto → etapas → marco → tarefa →
documento → regulatório → importação → GTM → timeline → notificações →
relatórios/drill-down → arquivar → reabrir`

Verificado:

- criar um projeto cria as quatro etapas (`project-lifecycle`);
- progresso é derivado de etapas e tarefas e recalcula a cada escrita;
- cada etapa só aceita edição do seu dono (`stage-permissions`);
- arquivar tira do portfólio **sem apagar** — as etapas continuam lá — e some
  do portal imediatamente; reabrir devolve;
- o evento de arquivamento é interno: o fornecedor não é avisado;
- arquivar projeto fora do escopo falha com `NotFoundError`;
- relatórios agregam e cada número abre exatamente as linhas que o compõem
  (`permissions-and-drilldown`).

Rotas percorridas com sessão real (200, sem error boundary): `/dashboard`,
`/projects` e seus 5 recortes, `/tasks`, `/regulatory` e seus 6 filtros,
`/documents`, `/suppliers`, `/reports`, `/notifications`, `/team`,
`/settings`, e as 9 abas de um projeto real.

## 2. Regulatório: do pedido à aprovação

`criar solicitação → fornecedor recebe → upload → submissão → Vionex baixa →
revisão → correção pedida → histórico → reenvio → aprovação → tarefa-espelho
concluída → progresso → timeline → notificações`

Verificado (`regulatory-workflow`, 13 asserções, e
`review-history-and-attachments`):

- a solicitação abre tarefa-espelho em `WAITING`;
- só o fornecedor certo a enxerga; outro recebe `NotFoundError`;
- submissão move para `SUBMITTED` e a tarefa para `IN_PROGRESS`;
- **não é possível trocar o arquivo enquanto a Vionex analisa**;
- o revisor abre exatamente a versão em julgamento;
- pedir correção devolve a bola: tarefa volta a `WAITING`;
- a segunda versão **não substitui** a primeira;
- cada decisão vira uma linha de histórico com revisor, versão, motivo e data;
- uma decisão nova **acrescenta** rodada, não sobrescreve;
- aprovar fecha a tarefa-espelho com `completedAt`;
- fornecedor não reabre solicitação aprovada;
- a timeline conta a história e só a metade compartilhável;
- os dois lados são notificados nos momentos certos, com o veredito no texto;
- o outro fornecedor não recebe nada.

Quem pode decidir é governado pelo domínio do documento (PERM-2), verificado
com uma solicitação de cada tipo.

## 3. Fornecedor: do login à entrega

`login → Home → Projects → Action Required → solicitação → upload → tarefas
pela fila unificada → Documents → Messages → anexo → Notifications → Profile →
Users (SUPPLIER_ADMIN)`

Verificado (`information-architecture`, `supplier-portal-scope`,
`user-management`, `tenant-gate`):

- a fila reúne documentos e tarefas, e **nunca mostra a mesma pendência duas
  vezes** — a tarefa-espelho é excluída;
- o contador do menu conta o mesmo que a fila lista;
- o próximo prazo anunciado na Home é o primeiro prazo da fila;
- filtros *Tudo / Documentos / Tarefas* filtram de verdade;
- anexo de mensagem é baixável pelos dois lados da conversa e por mais ninguém;
- anexo de thread interna nasce `INTERNAL_ONLY` e é invisível ao fornecedor
  por dois caminhos independentes;
- `SUPPLIER_ADMIN` gere só a própria empresa, não consegue promover ninguém a
  papel interno, e não consegue deixar a empresa sem administrador ativo;
- `SUPPLIER_USER` não administra ninguém — recusado no serviço, não só na tela.

Executado no navegador como **SUPPLIER_ADMIN** e como **SUPPLIER_USER** (conta
de demonstração criada nesta rodada): as 9 rotas do portal respondem, e
`/supplier/users` só existe para o administrador.

## 4. Fronteiras

- Fornecedor em rota interna (`/dashboard`, `/projects`, `/reports`, `/team`,
  `/settings`, `/regulatory`): **307 → `/supplier`**.
- Interno em rota do portal: **307 → `/dashboard`**.
- `/supplier/tasks`: **307 → `/supplier/action-required?type=task`**.
- Fornecedor A com os identificadores reais de B — projeto, solicitação,
  versão, anexo, tarefa, thread, histórico de análise, notificação, usuário:
  **recusado em todos** (`tenant-gate`).
