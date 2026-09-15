# 38 — Questões em aberto

O que não pôde ser confirmado pela leitura do código. **Nada aqui foi
preenchido com suposição.**

## Só um teste real responde

| # | Pergunta | Por que importa | Como validar |
|---|---|---|---|
| 1 | O endereço de produção é alcançável da China continental, e com que latência? | Determina se o Supplier Portal funciona para os fabricantes chineses. **Não é verificável lendo código** | Abrir a URL de Xangai, Shenzhen e Pequim, em três operadoras. Medir tempo até interativo |
| 2 | O domínio exige registro ICP para uso comercial na China? | Regulatório | **LEGAL REVIEW REQUIRED** |
| 3 | O upload de 20 MB conclui numa rede chinesa típica? | É o fluxo central do produto | Teste real, com e sem interrupção |
| 4 | Um pooler em modo transação (Supabase 6543 / pgBouncer) é compatível com `@prisma/adapter-pg`? | *Prepared statements* nomeados podem colidir entre sessões. `.env.example` e `README.md` recomendam esse setup e **não tratam nem descartam** a incompatibilidade | Testar com `?pgbouncer=true` sob concorrência |
| 5 | Qual o comportamento real do pool sob carga? | Default de 10 conexões por processo × instâncias serverless | Teste de carga contra um Postgres gerenciado |
| 6 | A mensagem de `PrismaClientInitializationError` do Prisma 7 tem menos de 200 caracteres? | Se tiver, host e porta do banco chegam à interface via SEC-008 | Provocar o erro e observar |

## Decisões necessárias para a Rodada 1 (revisão 2 do plano)

Estas bloqueiam o início de A1. Detalhamento em
[26_MASTER_IMPLEMENTATION_PLAN.md](26_MASTER_IMPLEMENTATION_PLAN.md), seção
"Quatro problemas técnicos".

| # | Decisão | Por que precisa de você |
|---|---|---|
| A | **Nomenclatura de `APP_ENV`.** Proposto: `development`, `test`, `demo`, `preview`, `staging`, `production` | é contrato de operação, não só de código. Se a Vionex já usa outra convenção, adotá-la agora custa nada e depois custa caro |
| B | **O deploy automático de `main` continua?** Hoje push em `main` publica na Vercel sem nenhum portão. Instalar o CI não impede isso (C-4). Proposto: continua, mas apontando só para o endereço de demonstração com `APP_ENV=demo`; nenhum projeto de produção é criado em A1 | muda quem pode publicar e quando |
| C | **O deploy de demonstração continua existindo depois que produção subir?** | se sim, ele é o único lugar onde `APP_ENV=demo` roda, e precisa de endereço próprio e `noindex` |
| D | **Quem cria `APP_ENV` no painel da Vercel, e quando?** Precisa existir **antes** do merge de A1 (C-3), senão o deploy que introduz a guarda é o mesmo que a viola | acesso ao painel está fora do repositório |
| E | **Estratégia para o snapshot (C-1).** Proposto: versionar um stub de `snapshot/data.ts`. Alternativa: tirar o snapshot do grafo de módulos | a alternativa é mais limpa e mais cara; a escolha é sua |

## Decisões de negócio, não de engenharia

| # | Pergunta | Por que a engenharia não pode decidir |
|---|---|---|
| 7 | **Um prazo "15 de setembro" é o dia de quem?** Vionex, fornecedor, ou fim do dia em UTC−12? | Muda quem é penalizado. É uma regra comercial. Bloqueia a correção de GLB-002. Opções em [32](32_TIMEZONE_STRATEGY.md) |
| 8 | Um usuário interno deve alcançar **qualquer** projeto da organização? | Hoje sim — não há autorização por projeto nem por participação. Pode ser intencional numa equipe pequena (AUTH-003) |
| 9 | `VIEWER` deve poder baixar documentos `INTERNAL_ONLY`? | Hoje pode. O nome do papel sugere menos (AUTH-001) |
| 10 | Exclusão de dado pessoal: anonimizar no lugar ou excluir de fato? | Conflito entre direito ao esquecimento e cadeia de custódia regulatória. **LEGAL REVIEW REQUIRED** (GOV-D1) |
| 11 | Por quanto tempo guardar documentos, mensagens e auditoria? | Provavelmente regido por norma de dispositivos médicos. **LEGAL REVIEW REQUIRED** (GOV-D2) |
| 12 | Os documentos podem sair da União Europeia? E da China? | **LEGAL REVIEW REQUIRED** ([34](34_DATA_RESIDENCY.md)) |
| 13 | Qual RPO e qual RTO a Vionex aceita? | Define custo e arquitetura do backup ([16](16_BACKUP_AND_RESTORE.md)) |
| 14 | O deploy de demonstração continua existindo num endereço separado depois que produção subir? | Muda como o bloqueador SEC-001 é fechado |
| 15 | O chinês deve voltar ao seletor de idioma? | O dicionário existe e está bom. Foi removido no commit `54c3191` |

## Funcionalidades incompletas — falta ou resto?

Cinco server actions completas, com permissão e validação, **sem nenhum
consumidor na interface**. Não é código morto: é funcionalidade não ligada. Qual
das duas hipóteses vale precisa de confirmação de quem escreveu.

| Action | Arquivo |
|---|---|
| `updateUserAction` | `src/server/actions/users.ts` |
| `updateStageAction` | `src/server/actions/projects.ts` |
| `updateSupplierAction` | `src/server/actions/suppliers.ts` |
| `createMilestoneAction` | `src/server/actions/stages.ts` |
| `markThreadReadAction` | `src/server/actions/messages.ts` |

Na mesma categoria:

- **`project.archive`** está declarado em `AuditAction` e nunca é emitido;
  `Project.archivedAt` existe no schema, é filtrado em 4 lugares e **nada nunca o
  escreve**. Não existe arquivamento nem exclusão de projeto.
- **`portal:manage-users`** é uma capacidade de `SUPPLIER_ADMIN` sem nenhuma tela
  (AUTH-002).
- **`DocumentVersion.checksum`** existe e nunca é preenchido — é exatamente a
  ferramenta para reconciliar storage contra banco (REL-001).
- **`EMAIL_SERVER` / `EMAIL_FROM`** declarados e nunca lidos. Não há envio de
  e-mail: um fornecedor só descobre uma solicitação se entrar no portal.
- **`APP_URL`** declarado e nunca lido — o próprio schema comenta isso.

## Não verificável nesta auditoria

| # | Item | Por quê |
|---|---|---|
| 16 | Configuração real do projeto na Vercel — região, variáveis, proteção de deploy | não há `vercel.json` versionado; tudo vive no painel |
| 17 | Quem tem acesso ao painel da Vercel e ao GitHub | fora do repositório |
| 18 | Se o deploy atual já recebeu algum dado real | não inspecionei nenhum ambiente ao vivo |
| 19 | Comportamento sob concorrência real | exigiria executar carga |
