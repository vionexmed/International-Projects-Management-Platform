# 40 — Scorecard

Cada nota tem justificativa baseada em evidência. Onde a nota é baixa, isso não
significa código ruim — significa ausência verificada.

| Dimensão | Nota | Justificativa |
|---|---:|---|
| **Architecture** | **7,5** | Fluxo coerente, nenhum arquivo acima de 500 linhas, nenhum god service, nenhuma dependência circular. Perde por 11 páginas consultando o banco direto (todas escopadas hoje, verificado) e por serviços lançando `Error` genérico |
| **Backend** | **7,5** | `ActionState` único e bem desenhado, Zod em toda action, `requirePermission` em todas. Perde por `toActionError` filtrar por comprimento de string e por duas actions falharem em silêncio |
| **Frontend** | **7,0** | Fronteira servidor/cliente limpa, nenhum componente cliente importando Prisma, nenhuma variável `NEXT_PUBLIC_*`. Perde por campos internos no payload RSC do fornecedor |
| **Database** | **7,0** | 23 models bem modelados, sem drift, migrations limpas. Perde por uma FK ausente, audit log em cascata, e três políticas de autoria conflitantes |
| **SQL** | **8,0** | **Zero injeção, zero N+1**, agregação por `groupBy` em vez de contagem por linha, três listas principais paginadas. Perde por índices de ordenação ausentes e busca `ILIKE` sem `pg_trgm` |
| **Security** | **3,0** | Os controles construídos são excelentes — cabeçalhos, CSP, cookie, hash, throttle, path traversal, open redirect. **Mas três caminhos independentes levam a comprometimento total**, e um controle que pode ser contornado não conta |
| **Authentication** | **5,0** | Login exemplar: throttle no banco, hash dummy contra enumeração, bcrypt 12, cookie só com identidade. Perde por MFA ausente, revogação ausente, 30 dias de sessão, throttle de IP contornável, e a porta lateral sem senha |
| **Authorization** | **8,5** | Matriz limpa, pura, testada, aplicada em toda action. **Nenhum IDOR** nas 7 guardas e em todas as rotas parametrizadas. Perde por `VIEWER` alcançar documentos `INTERNAL_ONLY` e por `portal:manage-users` sem implementação |
| **Multitenancy** | **7,0** | Escopo composto dentro da consulta, âncora dupla, falha fechada, três camadas barrando sessão inválida. Perde por campos internos vazando, por nenhuma RLS, e por 16 de 23 tabelas sem coluna de tenant |
| **Storage** | **7,5** | Nada público, nada assinado, chave imprevisível, path traversal barrado, download reescopado e auditado, `filename*=UTF-8''` correto. Perde por órfãos sem compensação, ausência de streaming e `local` em produção |
| **UI** | **7,5** | Estética declarada cumprida: paleta de 36 tokens, zero gradiente, profundidade por hairline, `tabular-nums`. Perde por 363 valores arbitrários, duas escalas tipográficas colidindo e animações declaradas sem o plugin |
| **UX** | **6,5** | Home do fornecedor é uma pergunta, não um dashboard; estados vazios distinguem vazio de filtrado; abas e filtros são URLs. Perde porque o fluxo mais importante — fornecedor enviando arquivo — não tem progresso, perde o formulário ao falhar e mostra arquivo fantasma ao acertar |
| **Accessibility** | **5,0** | Zero `onClick` em `div`, um `h1` por página, landmarks reais, `aria-current`, `prefers-reduced-motion` correto. Perde por foco invisível (1,09:1 em menus), `text-faint` a 2,79:1 em todos os placeholders, `lang` errado e nenhum skip link |
| **Testing** | **5,0** | `scopes.test.ts` prova **ausência**, não só presença — é o teste certo do jeito certo. Perde porque **os 14 testes de isolamento são pulados em silêncio sem banco**, e porque não há teste de componente, de action, de E2E nem de fuso |
| **Observability** | **2,0** | Zero `console.log` de depuração, prefixos consistentes, nenhum segredo logado, `/api/health` com três estados. Perde porque **não existe nada mais**: nenhum logger, nenhum alerta, nenhum lugar onde o `digest` signifique algo |
| **Performance** | **6,0** | Nenhum N+1, agregação correta, fronteira cliente limpa, índices coerentes com o acesso. Perde por 14+ consultas sem limite, `include` pesados nas guardas e 6,4 MB de snapshot em todo build |
| **Reliability** | **4,0** | Transações nos lugares certos, `@@unique` transformando corrida em erro, `getCurrentUser` fail-closed. Perde por nenhum timeout, nenhuma idempotência, nenhuma compensação de falha parcial e duplo clique duplicando conteúdo |
| **Governance** | **3,0** | `.env` fora do git, commits descritivos, `AGENTS.md`, zero `TODO`. Perde porque **o CI existe e não está instalado**, não há PR, não há staging, não há preview e a configuração de deploy não é versionada |
| **Data Governance** | **3,0** | Classificação implícita coerente, download auditado, chaves namespaced. Perde por não existir caminho técnico de exclusão, nenhuma política de retenção, e uma trilha de auditoria sem leitura e que perde entradas em silêncio |
| **DevOps** | **2,5** | Deploy funciona e é reproduzível. Perde por não haver CI ativo, nem migrations no pipeline, nem staging, nem rollback exercitado, nem backup |
| **Production Readiness** | **2,0** | Três caminhos para comprometimento total, perda silenciosa de dados, nenhum alerta. A nota não reflete a qualidade do código — reflete a distância até poder receber dado real |
| **Internationalization** | **4,0** | Fundação boa e tipada. Perde por ~520 literais inline, login fixo em português, erros de servidor em português e nenhuma negociação de idioma |
| **Localization** | **5,0** | pt-BR e en completos e verificados pelo compilador; `Intl` usado corretamente. Perde por composição que quebra a gramática chinesa, pluralização binária e texto persistido com idioma congelado |
| **Timezone Safety** | **3,0** | Nenhum `DATE`, nenhum `timestamptz`, nenhum fuso de usuário, zero testes, e "atrasado" factualmente errado em todo fuso. Não é 1 ou 2 apenas porque o par entrada-UTC/saída-UTC preserva o dia exibido — invariante acidental, não documentada, e já violada por `formatDateTime` |
| **Unicode** | **6,0** | Armazena e entrega corretamente; `Content-Disposition` conforme RFC 5987; CSV com BOM. Perde por nenhuma collation, `ILIKE` sem `unaccent`, gate de 2 caracteres inutilizando busca CJK e stack de fonte sem CJK |
| **China Readiness** | **7,0** | CSP sem **nenhuma** exceção de origem, fonte auto-hospedada verificada no bundle, throttle em vez de captcha. Perde por tipografia CJK ausente e por a hospedagem não ser verificável em código |
| **Global Performance** | **4,0** | Perde por todo arquivo trafegar pela função, em memória, sem CDN, sem `Range` e sem retomada |
| **Global Readiness** | **4,5** | Média ponderada das dimensões globais, puxada para baixo por Timezone Safety e por Data Residency |

## Média

| Grupo | Média |
|---|---:|
| Engenharia (Architecture, Backend, Frontend, Database, SQL) | **7,4** |
| Segurança e acesso (Security, Auth, Authorization, Multitenancy, Storage) | **6,2** |
| Produto (UI, UX, Accessibility) | **6,3** |
| Operação (Testing, Observability, Reliability, Performance, Governance, Data Gov., DevOps) | **3,6** |
| Global (I18n, L10n, Timezone, Unicode, China, Global Perf.) | **4,8** |

## Leitura das notas

A distribuição conta a história melhor que qualquer número isolado: **o código
está em 7,4 e a operação em 3,6.**

Isto não é um projeto com problemas de engenharia. É um projeto bem construído
que ainda não foi preparado para operar — sem CI ligado, sem backup, sem alerta,
sem staging, e com o modo de demonstração ainda aberto.

Essa é uma distância muito mais fácil de percorrer do que o inverso.
