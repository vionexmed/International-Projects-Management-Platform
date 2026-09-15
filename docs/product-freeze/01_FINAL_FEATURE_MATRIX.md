# Matriz final de funcionalidades

Classificação após PC-6B. **COMPLETE** exige funcionar ponta a ponta — não
basta renderizar.

| Estado | Significa |
|---|---|
| COMPLETE | funciona do início ao fim, com persistência, permissão e teste |
| PARTIAL | funciona, com limite conhecido e declarado |
| VISUAL_ONLY | renderiza sem fazer nada |
| MISSING | declarado e inexistente |
| BROKEN | existe e falha |
| FUTURE | fora do escopo funcional, pertence à produtionização |

## Projetos

| Item | Estado | Nota |
|---|---|---|
| Listar, buscar, filtrar, paginar | COMPLETE | filtros: status, atenção, etapa, fornecedor, responsável, país, arquivados |
| Criar projeto | COMPLETE | cria as 4 etapas automaticamente |
| Editar dados gerais | COMPLETE | ADMIN/MANAGER (PERM-1) |
| Arquivar e reabrir | COMPLETE | arquiva, não apaga; some do portal na hora |
| Progresso derivado | COMPLETE | etapas + tarefas, recalculado a cada escrita |
| Marcos | COMPLETE | criação governada pelo dono da etapa |
| Overview | COMPLETE | estado atual; preview de 3 eventos |
| Timeline | COMPLETE | histórico completo, com marca de interno |

## Etapas

| Item | Estado | Nota |
|---|---|---|
| Clínico / Regulatório / Importação / GTM | COMPLETE | cada um com a sua capacidade |
| Edição de etapa (status, progresso, notas) | COMPLETE | só o dono da etapa |

## Documentos

| Item | Estado | Nota |
|---|---|---|
| Upload versionado | COMPLETE | versões acumulam, nunca substituem |
| Download autenticado | COMPLETE | rota única, escopo reaplicado, auditado |
| Visibilidade interna × compartilhada | COMPLETE | aplicada na query |
| Repositório global com filtros e paginação | COMPLETE | |
| Metadados | COMPLETE | nome, tipo, tamanho, versão, quem enviou, quando, visibilidade, projeto |
| Antivírus no upload | FUTURE | validação hoje é MIME × extensão × tamanho |

## Ciclo regulatório

| Item | Estado | Nota |
|---|---|---|
| Solicitar documento | COMPLETE | com tarefa-espelho opcional |
| Fornecedor responde | COMPLETE | upload + mensagem |
| Vionex baixa o arquivo em análise | COMPLETE | do próprio diálogo de decisão |
| Revisar (aprovar / pedir correção) | COMPLETE | por domínio (PERM-2) |
| Histórico de rodadas | COMPLETE | quem, qual versão, por quê, quando |
| Reenvio preservando versões | COMPLETE | |
| Tarefa-espelho fecha ao aprovar | COMPLETE | |
| Fila global com filtros e paginação | COMPLETE | 6 recortes, contagem em SQL |

## Tarefas

| Item | Estado | Nota |
|---|---|---|
| Criar, editar, concluir | COMPLETE | |
| Comentário interno × compartilhado | COMPLETE | interno nunca notifica fornecedor |
| Filtros, busca, paginação, atrasadas | COMPLETE | |
| Espelho de solicitação não duplica | COMPLETE | excluído na fila e na triagem |

## Mensagens

| Item | Estado | Nota |
|---|---|---|
| Thread por projeto | COMPLETE | |
| Enviar, ler, contador de não lidas | COMPLETE | |
| Anexo | COMPLETE | vira DocumentVersion; mesma porta de download |
| Thread interna × com fornecedor | COMPLETE | anexo herda a visibilidade da thread |

## Notificações

| Item | Estado | Nota |
|---|---|---|
| 10 tipos emitidos | COMPLETE | todos os declarados no schema |
| Marcar como lida | COMPLETE | |
| Sem repetição | COMPLETE | `notifyOnce` |
| Prazo vencido sem ninguém abrir a tela | FUTURE | falta scheduler |

## Fornecedores

| Item | Estado | Nota |
|---|---|---|
| Diretório e perfil | COMPLETE | projetos como resumo + link |
| Criar e editar | COMPLETE | ADMIN/MANAGER |
| Usuários do portal | COMPLETE | criados pela Vionex ou pelo SUPPLIER_ADMIN |

## Supplier Portal

| Item | Estado | Nota |
|---|---|---|
| Home como resumo | COMPLETE | pendências, próximo prazo, projetos, updates |
| Action Required como fila única | COMPLETE | documentos + tarefas, filtros reais |
| Projetos, documentos, mensagens, timeline | COMPLETE | projeção estreita, sem campo interno |
| Perfil e idioma | COMPLETE | pt-BR / en / zh |
| Gestão de usuários (SUPPLIER_ADMIN) | COMPLETE | com proteção contra ficar sem administrador |
| `/supplier/tasks` | COMPLETE | redirect 307 para a fila filtrada |

## Relatórios

| Item | Estado | Nota |
|---|---|---|
| Distribuições (status, etapa, país) | COMPLETE | |
| Prazos | COMPLETE | atrasadas com drill-down; as demais sem link, por honestidade |
| Desempenho por fornecedor | COMPLETE | resposta média `—` quando não há resposta |
| Funil regulatório | COMPLETE | números idênticos aos da fila, pela mesma função |
| Exportação CSV | COMPLETE | 3 relatórios |
| Rodadas de análise | PARTIAL | só a partir da migration de PC-5; declarado na tela |

## Plataforma

| Item | Estado | Nota |
|---|---|---|
| Login, sessão, throttle | COMPLETE | |
| Trocar senha | COMPLETE | |
| Criar primeira conta | COMPLETE | via script |
| Isolamento por fornecedor | COMPLETE | servidor, dentro da query |
| Auditoria | COMPLETE | sem política de expurgo (FUTURE) |
| Busca global | COMPLETE | escopada |
| Configurações | COMPLETE | só o que é real |
| i18n do portal | COMPLETE | 3 idiomas |
| Fuso horário em timestamps | PARTIAL | datas em UTC; horários no fuso do servidor |
| MFA, SSO, e-mail, IA | FUTURE | ausentes por decisão; não simulados |

## Contagem

| Estado | Total |
|---|---|
| COMPLETE | **57** |
| PARTIAL | **2** |
| VISUAL_ONLY | **0** |
| MISSING | **0** |
| BROKEN | **0** |
| FUTURE | **5** |

Os dois PARTIAL (rodadas de análise a partir de PC-5; fuso em timestamps) são
limites **declarados na própria interface ou nesta documentação** — nenhum
deles impede operar.
