# 10 — Definição de pronto (funcional)

> **Isto não é production readiness.** Ao cumprir esta lista, o produto está
> funcionalmente completo. A auditoria de produção ([docs/audit/](../audit/))
> vem depois, como etapa separada.

## Módulos core funcionais

- [ ] Todo módulo tem create, edit e mudança de status onde faz sentido — **hoje 5 capacidades são ausentes** (editar usuário, editar fornecedor, editar etapa, criar marco, arquivar projeto)
- [ ] Nenhum controle promete uma ação e apenas navega
- [ ] Nenhuma lista trunca em silêncio: ou pagina, ou diz que cortou
- [ ] Toda rota de detalhe tem `loading.tsx`
- [ ] Empty, loading e error existem nas rotas principais

## Workflows ponta a ponta

- [ ] **Regulatório fecha o ciclo**: solicitar → receber → revisar → aprovar **ou pedir de novo**, com o motivo preservado entre rodadas
- [ ] Aprovar um documento **fecha a tarefa espelho**
- [ ] O revisor consegue **baixar o arquivo na tela em que decide**
- [ ] Existe um lugar no ambiente interno onde as submissões pendentes aparecem
- [ ] Criar projeto → etapas → marcos → tarefas → progresso, com marcos criáveis pela interface
- [ ] Mensagem nos dois sentidos persiste, notifica e aparece nas duas interfaces

## Integração entre interno e portal

- [ ] Todo evento relevante gera notificação para a audiência certa
- [ ] Todo evento relevante grava timeline, **com a marcação interna correta**
- [ ] Upload avulso do fornecedor avisa a Vionex
- [ ] Documento compartilhado avisa o fornecedor
- [ ] Prazo próximo e vencido geram notificação — **hoje a plataforma nunca avisa ninguém**

## Permissões

- [ ] Matriz papel × ação revisada e **aprovada pelo negócio**
- [ ] As quatro divergências decididas: `project:update` amplo demais, `document:review` para IMPORT/MARKETING, etapas fora de `STAGE_MANAGE`, VIEWER e `INTERNAL_ONLY`
- [ ] Nenhuma ação de escrita sem `requirePermission` no servidor — **já verdade hoje, manter**
- [ ] A tela de Configurações só afirma o que é verdade

## Isolamento do fornecedor

- [x] **Testado e passando** — 14 testes de isolamento + 8 de payload
- [x] **Nenhum dado interno chega ao fornecedor** — verificado por serialização do payload
- [x] A suíte **falha** quando o banco está inalcançável, em vez de pular
- [ ] Teste cobrindo cada guarda nova que for criada

## Documentos

- [x] Upload, download, versões e permissões funcionam
- [ ] Metadados editáveis: renomear, reclassificar, **mudar visibilidade**
- [ ] Nova versão pela interface, nos dois lados
- [ ] Anexo em mensagem *(exige schema — ver [07](07_SCHEMA_CHANGES_REQUIRED.md))*

## Tarefas

- [x] Create, edit, assign, prazo, prioridade, status, comentários
- [ ] Os seis status utilizáveis: Open, In progress, Waiting, Completed, **Overdue** (derivado — correto assim), Cancelled
- [ ] O fornecedor **vê** as tarefas que esperam por ele

## UX crítica do fornecedor

- [x] **UX-001** o erro não apaga o formulário
- [x] **UX-002** o envio tem sinal claro
- [x] **UX-003** a zona de arquivo limpa de verdade
- [x] **UX-012** logout e idioma no celular
- [ ] 404 e mensagens de erro no idioma do fornecedor
- [ ] Nenhum texto em português no portal

## Testes

- [x] Isolamento entre fornecedores
- [x] Payload do fornecedor sem campos internos
- [x] Matriz de ambiente e modo demo
- [ ] Um teste por workflow principal ponta a ponta
- [ ] Contrato de CI por invariante: `0 failed`, `0 unexpected skipped`, suítes críticas executadas

## O portão que não se negocia

> **Nenhum piloto com fornecedor externo** antes de UX-001, UX-002 e UX-003
> estarem resolvidos **e testados em rede lenta, com queda no meio do envio**.

Os três já estão corrigidos. Falta o teste em condição de rede real.
