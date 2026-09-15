# Lacunas restantes que não são de produtionização

O que sobrou **dentro** do escopo funcional. Nenhuma impede operar; todas estão
declaradas em vez de escondidas.

## 1. Rodadas de análise começam na migration de PC-5

`DocumentRequestReview` passou a existir em 15/09/2026. Decisões anteriores não
foram reconstruídas — o sistema não guardava revisor, versão e motivo de forma
estruturada, e inventar isso numa pasta regulatória é pior que a lacuna.

A tela de Relatórios diz isso quando não há rodadas, e informa a data de início
quando há.

**Não é um bug.** É o limite honesto de um histórico que começou.

## 2. Horário em timestamps usa o fuso do servidor

Prazos são datas e foram alinhados em UTC nesta rodada (ver §5). Mas
`formatDateTime` — mensagem, upload, decisão — renderiza no fuso de quem roda
o servidor. Um fornecedor em Shenzhen lê horários de São Paulo.

Corrigir exige decidir onde formatar (cliente) ou guardar o fuso do usuário.
Pertence ao Global Readiness, com o resto.

## 3. `REGULATORY` cria projeto mas não edita

Consequência de PERM-1, deixada explícita. Criar continua permitido; editar os
dados gerais depois, não. Se a Vionex quiser que só ADMIN/MANAGER criem, é uma
linha — mas é decisão de produto, e não foi tomada por conta própria.

## 4. Ambiente interno é pt-BR no código

O portal é trilíngue pelo dicionário. O ambiente interno tem textos em
português direto no componente, por decisão de produto (o público é a equipe
brasileira). Se um dia a Vionex tiver equipe fora do Brasil, isso vira
trabalho de tradução — não dívida escondida.

## 5. Prazos dependem de alguém abrir a tela

`TASK_DUE_SOON` e `TASK_OVERDUE` são emitidos quando o código roda, e o código
roda quando alguém visita. Sem visita, sem aviso. Um cron resolve, e cron é
infraestrutura.

## 6. Auditoria sem expurgo

`AuditLog` registra tudo e cresce para sempre. Política de retenção é decisão
de compliance + infraestrutura.

## 7. Suppliers sem paginação

`/suppliers` lista o diretório inteiro, sem pager. Intencional na escala atual
(dezenas de fabricantes, não milhares) e com busca. Se a escala mudar, o padrão
de paginação já existe em quatro outras listas.

## 8. Sem exclusão de dados

Projeto arquiva, usuário suspende, documento versiona. Seis foreign keys
`Restrict` impedem apagar quem produziu trabalho. É uma escolha de produto —
histórico regulatório que pode ser apagado não é histórico. Se a Vionex
precisar de exclusão por LGPD/GDPR, é um trabalho próprio, com decisão sobre o
que fazer com a autoria dos registros.
