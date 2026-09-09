# Vionex Projects

**International Projects Management Platform**

Plataforma corporativa para a Vionex gerenciar projetos internacionais com fornecedores e
fabricantes da China, Europa, Estados Unidos e demais mercados — substituindo a combinação
de e-mail, WhatsApp, planilhas e pastas por um canal único e rastreável.

> *Manage every project. One place.*

---

## Sumário

- [Objetivo](#objetivo)
- [Os dois ambientes](#os-dois-ambientes)
- [Stack](#stack)
- [Instalação](#instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Seed e credenciais de demonstração](#seed-e-credenciais-de-demonstração)
- [Como executar](#como-executar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Papéis e permissões](#papéis-e-permissões)
- [Preview de desenvolvimento](#preview-de-desenvolvimento)
- [Colocar em produção](#colocar-em-produção)
- [Isolamento de fornecedores](#isolamento-de-fornecedores)
- [Documentos e armazenamento](#documentos-e-armazenamento)
- [Regras automáticas de status](#regras-automáticas-de-status)
- [Auditoria](#auditoria)
- [Idiomas](#idiomas)
- [Testes](#testes)
- [Como criar usuários](#como-criar-usuários)
- [Decisões de arquitetura](#decisões-de-arquitetura)
- [Roadmap sugerido](#roadmap-sugerido)
- [Preparado para o futuro](#preparado-para-o-futuro)

---

## Objetivo

O sistema responde, a qualquer momento, às perguntas que hoje se perdem entre canais:

- Qual é o status real de cada projeto?
- Quem é o responsável e o que está pendente?
- Quem precisa responder e qual é o prazo?
- Qual documento já foi recebido e qual ainda falta?
- O que aconteceu antes e qual é o próximo passo?

---

## Os dois ambientes

| Ambiente | Rota base | Quem usa | Idioma padrão |
|---|---|---|---|
| **Vionex Internal** | `/dashboard` | Equipe Vionex | Português |
| **Supplier Portal** | `/supplier` | Fabricantes e fornecedores | Inglês |

Os dois compartilham o mesmo banco de dados, mas têm interfaces, navegação e permissões
distintas. Um fornecedor **nunca** enxerga dados de outro fornecedor.

Ambos os ambientes têm **busca global** (⌘K / Ctrl+K) sobre projetos, tarefas, documentos e
fornecedores, **troca de senha** pelo menu de conta e **navegação em telas estreitas**.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Linguagem | TypeScript (modo estrito, sem `any`) |
| UI | React 19, Tailwind CSS v4, Radix UI primitives |
| Banco | PostgreSQL |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Autenticação | Sessão própria: JWT assinado (`jose`) em cookie `httpOnly` + `bcryptjs` |
| Validação | Zod |
| Formulários | React Hook Form + Server Actions |
| Ícones | Lucide React |
| Storage | Abstração com drivers `local` e `s3` (compatível com S3) |
| Testes | Vitest |

---

## Instalação

**Pré-requisitos:** Node.js 20+ e npm.
PostgreSQL **não** precisa estar instalado — veja [Banco de dados](#banco-de-dados).

```bash
npm install
cp .env.example .env
# gere um segredo de sessão:
openssl rand -base64 32   # cole em AUTH_SECRET no .env
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env`. Nenhum segredo real deve ser versionado.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão PostgreSQL. |
| `AUTH_SECRET` | sim | Segredo de assinatura da sessão (mín. 32 caracteres). |
| `APP_URL` | não | Origem pública da aplicação. |
| `STORAGE_DRIVER` | não | `local` (padrão) ou `s3`. |
| `STORAGE_LOCAL_DIR` | não | Diretório do driver local (padrão `./storage`). |
| `STORAGE_ENDPOINT` | s3 | Endpoint do serviço S3. |
| `STORAGE_REGION` | s3 | Região do bucket. |
| `STORAGE_ACCESS_KEY` | s3 | Access key. |
| `STORAGE_SECRET_KEY` | s3 | Secret key. |
| `STORAGE_BUCKET` | s3 | Nome do bucket. |
| `STORAGE_FORCE_PATH_STYLE` | não | `true` para provedores compatíveis (MinIO, R2). |
| `UPLOAD_MAX_SIZE_MB` | não | Limite de upload em MB (padrão `25`). |
| `EMAIL_SERVER` / `EMAIL_FROM` | não | Reservados para envio de e-mail (camada futura). |

O arquivo é validado com Zod em `src/lib/env.ts`: uma configuração inválida derruba a
aplicação na inicialização, e não na primeira requisição.

---

## Banco de dados

O projeto usa **PostgreSQL**. Se você já tem um servidor, basta apontar `DATABASE_URL`
para ele e pular para as migrations.

### PostgreSQL local sem instalação

Para desenvolvimento, o repositório traz um cluster PostgreSQL autocontido (binários
oficiais via `embedded-postgres`) — sem Docker, sem Homebrew, sem `sudo`:

```bash
npm run db:start     # inicia em localhost:5433 e cria a database
npm run db:status
npm run db:stop
npm run db:destroy   # remove o cluster local (.postgres/)
```

Os dados ficam em `.postgres/` (ignorado pelo Git).

### Migrations (Prisma)

```bash
npm run db:migrate      # cria/aplica migrations em desenvolvimento
npm run db:deploy       # aplica migrations existentes (produção/CI)
npm run db:studio       # inspeciona os dados no Prisma Studio
npm run db:reset        # recria o banco do zero e roda o seed
```

> **Prisma 7:** a URL de conexão não vive mais em `schema.prisma`. As migrations leem
> `prisma.config.ts`; a aplicação conecta pelo driver adapter em `src/server/db.ts`.

---

## Seed e credenciais de demonstração

```bash
npm run seed
```

Cria uma organização Vionex com **4 fornecedores** (China, Alemanha, Estados Unidos,
Itália), **6 projetos**, etapas, marcos, tarefas, documentos com versões, solicitações,
conversas, histórico e notificações — o suficiente para o produto parecer real.

> O seed **apaga** todos os dados existentes antes de recriá-los.

**Senha de todos os usuários de demonstração: `vionex123`**

| E-mail | Papel | Nome | Ambiente |
|---|---|---|---|
| `admin@vionex.com` | ADMIN | Lucas Silva | Internal |
| `manager@vionex.com` | MANAGER | João Mendes | Internal |
| `regulatory@vionex.com` | REGULATORY | Stefany Rocha | Internal |
| `marketing@vionex.com` | MARKETING | Maria Santos | Internal |
| `viewer@vionex.com` | VIEWER | Paulo Reis | Internal |
| `supplier@example.com` | SUPPLIER_ADMIN | John Smith · Manufacturer A | Supplier Portal |
| `liwei@example.com` | SUPPLIER_USER | Li Wei · Manufacturer A (中文) | Supplier Portal |
| `klaus@example.com` | SUPPLIER_ADMIN | Klaus Weber · Manufacturer B | Supplier Portal |
| `emily@example.com` | SUPPLIER_ADMIN | Emily Carter · Manufacturer C | Supplier Portal |

> Credenciais apenas para desenvolvimento. Nunca use estes acessos em produção.

---

## Como executar

```bash
npm run db:start     # PostgreSQL local
npm run db:deploy    # aplica as migrations
npm run seed         # dados de demonstração
npm run dev          # http://localhost:3000
```

Outros comandos:

```bash
npm run build        # build de produção
npm start            # serve o build
npm run lint         # ESLint
npm run typecheck    # TypeScript sem emitir
npm test             # suíte de testes
npm run create-admin # cria um administrador (usar em produção)
```

---

## Estrutura do projeto

```
prisma/
  schema.prisma          Modelo de dados (multi-tenant)
  migrations/            Migrations versionadas
  seed.ts                Dados de demonstração
scripts/
  local-db.mjs           Cluster PostgreSQL local para desenvolvimento
src/
  app/
    (auth)/login/        Autenticação
    (internal)/          Ambiente Vionex — dashboard, projetos, tarefas,
                         documentos, fornecedores, regulatório, relatórios,
                         equipe, notificações, configurações
    (supplier)/supplier/ Supplier Portal — home, projetos, ações necessárias,
                         documentos, mensagens
    api/files/           Download autenticado de arquivos
    api/reports/         Exportação CSV
  components/
    ui/                  Primitivas (button, table, dialog, badge, …)
    app/                 Componentes de aplicação (sidebars, filtros, timeline)
  features/              Componentes por domínio (projects, tasks, documents, …)
  server/
    auth/                Sessão, senha, usuário atual
    authz/               Permissões, escopos de consulta, guards de acesso
    services/            Regra de negócio (projects, tasks, documents, …)
    actions/             Server Actions (entrada validada + autorização)
    db.ts                Cliente Prisma
  lib/                   Utilidades, i18n, storage, formatação, validação
  types/                 Tipos compartilhados
tests/
  unit/                  Permissões, escopos, regras de status
  integration/           Isolamento de fornecedores, fluxos ponta a ponta, auth
```

Regra de ouro: **nenhuma regra de negócio dentro de componentes React.** Páginas leem
services; mutações passam por Server Actions que validam com Zod e verificam permissão.

---

## Papéis e permissões

| Papel | Alcance |
|---|---|
| `ADMIN` | Acesso total, incluindo usuários, permissões e configurações. |
| `MANAGER` | Portfólio completo, fornecedores e relatórios. |
| `REGULATORY` | Acesso completo às áreas regulatória e clínica. |
| `IMPORT` | Acesso completo à importação e logística. |
| `MARKETING` | Acesso completo ao Go-to-Market. |
| `VIEWER` | Somente leitura no ambiente interno. |
| `SUPPLIER_ADMIN` | Portal do próprio fornecedor + gestão dos usuários da própria empresa. |
| `SUPPLIER_USER` | Portal do próprio fornecedor, acesso operacional. |

A matriz completa (capacidade × papel) está em `src/server/authz/permissions.ts` e é
exibida em **Configurações → Papéis e permissões**. Toda Server Action chama
`requirePermission()` antes de qualquer escrita.

---

## Preview de desenvolvimento

Para revisar a interface sem digitar credencial a cada vez:

```
http://localhost:3000/dev
```

A página lista todas as contas de demonstração e entra com um clique. **Não é um bypass de
autenticação**: a rota emite a mesma sessão assinada que um login real produz, então papéis,
permissões e isolamento continuam valendo integralmente. Ela responde **404** sempre que
`NODE_ENV` é `production`, portanto não existe em build implantado.

---

## Colocar em produção

Recomendação: **Vercel** para a aplicação e **Supabase** para Postgres + Storage. O motivo
é específico deste código, não preferência: o Prisma 7 aqui usa o driver adapter `pg` sobre
TCP e a rota de download faz stream de `Buffer` pelo AWS SDK — APIs de Node, que rodam sem
alteração no Fluid Compute da Vercel. Em runtimes de edge seria necessário trocar a camada
de dados. E o Storage do Supabase é compatível com S3, então o driver que já existe funciona
apenas preenchendo variáveis.

Alternativas legítimas: qualquer host Node (VPS, Docker, ECS) e qualquer Postgres + bucket
S3. Nada no código é específico de provedor.

### 1. Provisionar os serviços

No Supabase, crie o projeto e anote:

| Onde | O que copiar |
|---|---|
| Settings → Database → Connection string → **Transaction pooler** (porta 6543) | `DATABASE_URL` |
| Settings → Database → Connection string → **Direct** (porta 5432) | `DIRECT_URL` |
| Storage → crie o bucket `documents` (**privado**) | `STORAGE_BUCKET` |
| Storage → S3 Connection → access keys | `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` |

O bucket precisa ser **privado**: todo download passa por `/api/files/[versionId]`, que
revalida o acesso a cada requisição. Um bucket público anularia o isolamento entre
fornecedores.

> O free tier do Supabase **pausa o projeto** por inatividade. Para uma ferramenta que a
> equipe usa todo dia, use plano pago.

### 2. Variáveis de ambiente

```bash
DATABASE_URL="postgresql://…@…pooler.supabase.com:6543/postgres"   # pooled
DIRECT_URL="postgresql://…@db.….supabase.co:5432/postgres"          # migrations
AUTH_SECRET="<openssl rand -base64 32>"                             # gere um novo
APP_URL="https://projetos.vionex.com"                               # https obrigatório
STORAGE_DRIVER="s3"
STORAGE_ENDPOINT="https://<projeto>.supabase.co/storage/v1/s3"
STORAGE_REGION="us-east-1"
STORAGE_ACCESS_KEY="…"
STORAGE_SECRET_KEY="…"
STORAGE_BUCKET="documents"
STORAGE_FORCE_PATH_STYLE="true"
```

A aplicação **se recusa a subir** em produção com `STORAGE_DRIVER=local`, com `APP_URL` em
http, ou com um `AUTH_SECRET` de template — falhar na inicialização é melhor que aceitar
uploads que desaparecem depois. As regras estão em `src/lib/env.ts` e são cobertas por
testes.

### 3. Migrations e primeiro acesso

```bash
npm run db:deploy      # aplica migrations (usa DIRECT_URL)
npm run create-admin   # cria o primeiro administrador, interativamente
```

`npm run seed` é **bloqueado** quando `NODE_ENV=production`: ele apaga tudo e cria contas
com senha pública. Use `create-admin`, que é aditivo, nunca sobrescreve uma conta existente
e registra a criação no audit log. A partir do login, crie a equipe em **Equipe** e os
acessos dos fabricantes em **Fornecedores → [empresa] → Adicionar usuário**.

### 4. Deploy

Na Vercel: conecte o repositório, cole as variáveis acima em Project Settings →
Environment Variables e faça o deploy. O `postinstall` roda `prisma generate`
automaticamente.

**Fixe a região da função na mesma região do banco** (Project Settings → Functions). Toda
requisição faz várias idas ao Postgres; função e banco em continentes diferentes é o maior
custo de latência evitável desta arquitetura.

### 5. Depois de subir — verifique

```bash
curl https://projetos.vionex.com/api/health     # {"status":"ok","database":"reachable"}
curl https://projetos.vionex.com/robots.txt     # Disallow: /
curl -I https://projetos.vionex.com/login       # CSP, HSTS, X-Frame-Options: DENY
```

O health check é o primeiro lugar a olhar depois de um deploy, porque distingue três
situações que pedem correções diferentes:

| Resposta | Significa | O que fazer |
|---|---|---|
| `misconfigured` (503) | Faltam variáveis — e ele **diz quais** | Preencher em Environment Variables e redeployar |
| `degraded` (503) | Configurado, mas o banco não responde | Conferir `DATABASE_URL` e se o projeto do banco não está pausado |
| `ok` (200) | Servindo | — |

Ele reporta apenas **nomes** de variáveis, nunca valores.

> **Antes de configurar as variáveis, o build passa mas toda página responde 500.** Isso é
> proposital: sem banco e sem storage a aplicação não tem como servir, e falhar fechado é
> melhor que servir pela metade. `/api/health` é o que explica o motivo.

E, com dois logins de fornecedores diferentes, confirme que cada um só vê a própria empresa.

### O que já está endurecido

| Item | Onde |
|---|---|
| CSP com nonce por requisição (`strict-dynamic`) | `src/proxy.ts` |
| HSTS, X-Frame-Options, Referrer-Policy, COOP/CORP, sem `x-powered-by` | `next.config.ts` |
| Toda página como `private, no-store` (conteúdo é por usuário) | `next.config.ts` |
| `robots.txt` bloqueando indexação (aplicação privada) | `src/app/robots.ts` |
| Health check com round-trip no banco | `src/app/api/health/route.ts` |
| Throttle de login no banco, por e-mail **e** por IP | `src/server/auth/throttle.ts` |
| Boundary de último recurso para falhas no root layout | `src/app/global-error.tsx` |
| Validação de ambiente que recusa configuração insegura | `src/lib/env.ts` |
| Seed bloqueado em produção + bootstrap seguro de admin | `prisma/seed.ts`, `scripts/create-admin.ts` |
| CI: lint, tipos, 85 testes e build a cada push | `.github/workflows/ci.yml` |

### O que ainda falta para operar com tranquilidade

1. **E-mail transacional** — sem ele o fornecedor só descobre uma solicitação se entrar no
   portal. É a maior lacuna funcional; depende de escolher provedor. Veja o Roadmap.
2. **Monitoramento de erros** — hoje os erros vão para o log do servidor. Um coletor
   (Sentry ou equivalente) mostra o que quebra em produção sem depender de alguém relatar.
3. **Backups verificados** — o Supabase faz backup automático nos planos pagos, mas
   restauração só conta depois de ser testada uma vez.
4. **Retenção** — `AuditLog`, `TimelineEvent` e `Notification` crescem para sempre. Não é
   problema no primeiro ano; vale uma política antes que seja.

---

## Isolamento de fornecedores

A regra mais importante do produto — e a mais testada.

1. **Escopos de consulta** (`src/server/authz/scopes.ts`) são funções puras da sessão.
   Toda listagem compõe seus filtros **em cima** de um escopo. Para uma sessão de
   fornecedor, o escopo sempre fixa o `supplierId` (direto ou via projeto).
2. **Guards de acesso direto** (`src/server/authz/access.ts`) reexecutam o escopo dentro
   da busca por id. Um id fora do escopo é **indistinguível** de um inexistente: o
   usuário recebe 404 e não descobre que o registro existe.
3. **Downloads** passam por `/api/files/[versionId]`, que revalida o acesso a cada
   requisição. Chaves de storage nunca chegam ao navegador.
4. **Visibilidade de documento** é explícita: o fornecedor só vê arquivos marcados como
   `SHARED_WITH_SUPPLIER` dentro de projetos da própria empresa.
5. **Timeline** oculta eventos marcados como internos.
6. Uma conta de fornecedor sem vínculo com fornecedor é **recusada no login** — nunca
   gera uma consulta sem escopo.

Nada disso depende de esconder elementos no frontend.

### Duas armadilhas do App Router que afetam isso

Ambas foram encontradas e corrigidas; ficam registradas porque são silenciosas.

**`instanceof` não é confiável entre chunks.** A mesma classe de erro pode ser instanciada
a partir de grafos de módulo diferentes (RSC e SSR são separados), fazendo
`error instanceof NotFoundError` ser `false` sem aviso. Por isso a identidade é checada com
os guards `isNotFoundError` / `isForbiddenError`, que comparam um marcador estável.

**`loading.tsx` pode transformar um 404 em 200.** Ele abre um Suspense que transmite a
shell antes do segmento aninhado resolver; quando o `notFound()` acontece, o status HTTP já
foi enviado. O resultado é uma página 404 correta servida com status 200. Por isso os
skeletons ficam dentro de um route group (`(index)/loading.tsx`) que cobre apenas a lista,
nunca a rota dinâmica irmã — e `tests/unit/route-structure.test.ts` trava essa invariante.

Layouts e páginas também renderizam **em paralelo**: não basta o layout tratar o erro, pois
uma rejeição não tratada na página irmã chega antes ao error boundary. Todo call site RSC
passa por `orNotFound()` (`src/server/authz/rsc.ts`), que torna o resultado o mesmo
independentemente de qual segmento resolve primeiro.

---

## Documentos e armazenamento

- Formatos aceitos: **PDF, DOCX, XLSX, PPTX, PNG, JPG/JPEG**.
- Tipo MIME **e** extensão são validados no servidor; divergência é rejeitada.
- Limite de tamanho configurável (`UPLOAD_MAX_SIZE_MB`), revalidado no servidor.
- Versionamento: cada envio cria uma `DocumentVersion` (`IFU_v1.pdf`, `IFU_v2.pdf`, …)
  e o documento aponta para a versão atual. Versões anteriores continuam acessíveis.
- Arquivos **nunca** são gravados no banco. O driver de storage é trocável:
  `STORAGE_DRIVER=s3` move tudo para um bucket sem alterar uma linha de aplicação.

---

## Regras automáticas de status

Simples e previsíveis (`src/server/services/project-health.ts`):

- Tarefa com prazo vencido e não concluída é exibida como **Atrasada** — derivado em
  tempo de leitura, sem job em segundo plano.
- Projeto com bloqueio explícito (ou etapa bloqueada) → **Bloqueado**.
- Projeto com tarefa crítica (alta/urgente) atrasada, ou 3+ tarefas atrasadas → **Em risco**.
- Projeto com todas as etapas concluídas → **Concluído**.
- Um projeto marcado manualmente como concluído nunca é reaberto pela regra automática.
- Progresso da etapa = proporção de tarefas concluídas na categoria, com override manual.
  Progresso do projeto = média das quatro etapas.

---

## Auditoria

`AuditLog` registra autor, ação, entidade, id e metadados para: criação e alteração de
projeto, mudança de status, criação e alteração de tarefa, comentário, upload e
versionamento de documento, solicitação, resposta do fornecedor, revisão, download,
mensagem, criação e alteração de usuário e permissão, login e logout.

O registro nunca derruba a operação que o originou: uma falha de auditoria é logada,
não propagada.

---

## Idiomas

- Ambiente interno: **Português**.
- Supplier Portal: **Inglês**, com troca para **Português** e **中文** no próprio portal.
- Dicionários em `src/lib/i18n/dictionaries/` com cadeia de fallback
  `locale → en → pt-BR`. O chinês é parcial no MVP e cai no fallback quando faltar chave.
- O idioma é uma preferência da conta e persiste entre sessões.

Para adicionar um idioma: crie o dicionário, registre-o em `src/lib/i18n/dictionary.ts`.
Nenhuma página precisa mudar.

---

## Testes

```bash
npm test           # executa toda a suíte
npm run test:watch
```

Requer o banco no ar (`npm run db:start`). Os testes de integração criam a **própria
organização**, com dados isolados, e a removem ao final — o seed de demonstração não é
afetado.

Cobertura das partes críticas:

| Arquivo | O que garante |
|---|---|
| `tests/unit/permissions.test.ts` | Matriz de papéis; fornecedor nunca alcança administração interna. |
| `tests/unit/scopes.test.ts` | Todo escopo de fornecedor fixa o próprio `supplierId`. |
| `tests/unit/project-health.test.ts` | Progresso e status automático, incluindo casos-limite. |
| `tests/integration/supplier-isolation.test.ts` | **Fornecedor A não acessa nada do Fornecedor B** — projeto, documento, tarefa, solicitação, conversa e empresa. |
| `tests/integration/workflows.test.ts` | Criação de projeto com etapas, tarefas, ciclo completo de solicitação → envio → revisão, versionamento, upload inválido, mensagens, status automático. |
| `tests/integration/auth.test.ts` | Hash de senha, sessão assinada, token adulterado, ausência de papel no token, rotação de senha. |
| `tests/unit/route-structure.test.ts` | Nenhum `loading.tsx` cobre uma rota dinâmica — a invariante que mantém o 404 real. |
| `tests/unit/env.test.ts` | Produção recusa storage local, http e segredo de template. |
| `tests/integration/throttle.test.ts` | Bloqueio de login por e-mail e por IP; trocar de IP não zera o bloqueio da conta. |

---

## Como criar usuários

**Pela interface**

- Equipe interna: **Equipe → Convidar membro** (requer `ADMIN`).
- Fornecedor: **Fornecedores → [empresa] → Adicionar usuário** (requer `ADMIN` ou
  `SUPPLIER_ADMIN` da própria empresa).

Duas invariantes são garantidas no servidor: papel de fornecedor exige vínculo com
fornecedor, e papel interno não pode ter vínculo. Um `SUPPLIER_ADMIN` só cria usuários
da própria empresa.

**Por script** — use `createUser()` de `src/server/services/users.ts`, que aplica as
mesmas regras.

---

## Decisões de arquitetura

Pontos em que a implementação se afasta de uma leitura literal da especificação, e por quê:

- **`SupplierUser` não é uma tabela separada.** Usuários de fornecedor são registros de
  `User` com `supplierId` preenchido, exatamente como descrito na seção de
  relacionamentos. Uma tabela paralela duplicaria identidade e autenticação.
- **`Role`/`Permission` vivem no código, não no banco.** A matriz é um `Record` tipado,
  testável em unidade e impossível de dessincronizar do `enum` do schema. Tabelas
  editáveis sem uma tela de edição seriam peso morto. A matriz é exibida em
  Configurações.
- **Autenticação própria em vez de Auth.js.** A especificação permite "solução segura
  equivalente". Uma sessão assinada com `jose` + `bcryptjs` dá controle total sobre o
  modelo de sessão interna/fornecedor — central para o isolamento — sem depender de uma
  versão beta acoplada ao Next 16. O cookie carrega apenas identificadores: papel e
  vínculo de fornecedor são relidos do banco a cada requisição, então revogar ou
  rebaixar um acesso passa a valer na requisição seguinte.
- **Sem TanStack Table.** Busca, filtros, ordenação e paginação acontecem no servidor via
  `searchParams`. As tabelas são Server Components: cada estado é uma URL real,
  compartilhável e correta após um refresh, e nenhum runtime de tabela vai para o cliente.
- **"Atrasado" é derivado, não armazenado.** Evita um job periódico e impede que o dado
  fique mentindo entre execuções.

---

## Roadmap sugerido

O MVP cobre o ciclo completo de trabalho, mas há lacunas conhecidas. Em ordem de impacto
real na operação:

### 1. E-mail transacional — maior ganho, exige decisão de provedor

Hoje tudo é notificação in-app: **o fornecedor só descobre uma solicitação se entrar no
portal**. Para um fabricante em outro fuso, isso quebra o fluxo de cobrança, que é a razão
de ser da plataforma. `notify()` já separa *criar* de *entregar*, então um transporte de
e-mail consome as mesmas linhas de `Notification` sem tocar em nenhum caller.

Necessário: escolher provedor (Resend, SES, SMTP corporativo) e preencher `EMAIL_SERVER` /
`EMAIL_FROM`.

### 2. Recuperação de senha por e-mail

Depende do item 1. Hoje o link "Forgot password?" abre um e-mail para o suporte, e a
redefinição é manual. Com e-mail disponível, o fluxo padrão (token de uso único com
expiração curta) é direto.

### 3. Convite de fornecedor por link

Hoje a Vionex cria o acesso com uma senha inicial e precisa transmiti-la por fora. Um
convite com token elimina a senha em trânsito e melhora a primeira impressão do parceiro.

### 4. Anexos em mensagens

`Message` é texto puro. A spec (§31) prevê anexos; a infraestrutura de upload e storage já
existe e pode ser reaproveitada.

### 5. Lembretes automáticos de prazo

Um job diário que avisa responsável e fornecedor sobre prazos próximos e vencidos. Depende
do item 1 para ter efeito fora da plataforma.

### 6. Ações em massa

Reatribuir, mudar prazo ou fechar várias tarefas de uma vez. Só passa a doer com volume.

### Fora de escopo por decisão

IA (resumo de projeto, extração de dados de documentos, relatório automático) e automações
complexas foram deixadas de fora do MVP a pedido. Veja a seção seguinte.

---

## Preparado para o futuro

A arquitetura foi montada para receber, sem reescrita:

- **IA** (resumo de projeto, leitura e extração de documentos, detecção de pendências,
  relatório automático em inglês, alertas): os services já expõem o estado consolidado
  do projeto, e `TimelineEvent` guarda o histórico estruturado que serve de contexto.
- **Automações** (e-mail, lembrete de prazo, cobrança de fornecedor, mudança automática
  de status, webhooks): `notify()` já separa *criar* de *entregar* — um transporte novo
  consome as mesmas linhas de `Notification`.
- **Integrações** (calendário, armazenamento externo): o storage é uma interface com
  drivers; trocar de provedor não toca a aplicação.

Nada disso está implementado no MVP, por decisão de escopo.

---

© Vionex — Vionex Projects · International Projects Management Platform
