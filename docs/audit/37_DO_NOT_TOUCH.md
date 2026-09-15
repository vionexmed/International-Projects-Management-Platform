# 37 — O que NÃO deve ser mexido

Estas áreas estão certas. Várias resolvem problemas sutis cuja razão está escrita
no próprio código. Mudá-las sem necessidade só pode piorar.

## O núcleo de isolamento — `src/server/authz/`

**`scopes.ts`** — 8 funções puras, sem efeito colateral, testáveis sem banco.
Três decisões que devem ser preservadas:

1. **Falha fechada.** `supplierIdOf()` lança se a sessão não tiver `supplierId`,
   em vez de devolver `undefined` — que o Prisma interpretaria como "sem filtro".
2. **Âncora dupla.** `taskScope` fixa `supplierId` **e** `project.supplierId`.
3. **`documentScope` ignora `Document.supplierId` de propósito**, escopando
   exclusivamente pela relação com o projeto, *"so a mis-set Document.supplierId
   can never widen visibility"*.

**`access.ts`** — as 7 guardas compõem o escopo **dentro** do `findFirst`. Não
trocar por "buscar e depois comparar": a forma atual elimina a classe inteira de
bugs em que alguém esquece o `if`, e faz um id fora do escopo ser indistinguível
de um inexistente.

**`errors.ts`** — guardas por `error.name`, **não** por `instanceof`. O comentário
explica: os grafos de módulo RSC e SSR são separados, e `instanceof` fica
silenciosamente falso. Como a distinção decide entre 404 e 403, **segurança não
pode depender de como o bundler dividiu o código.**

**`rsc.ts`** — `orNotFound()` existe porque layout e página renderizam em
paralelo no App Router; tratar o erro só no layout deixa a página irmã rejeitar
primeiro e transformar um 404 em tela de erro 200. Aplicado em 36 pontos.

## Autenticação — `src/server/auth/`

- **O cookie carrega apenas `sub` e `org`.** Papel, status e `supplierId` são
  relidos do banco a cada requisição. Revogar ou rebaixar uma conta tem efeito na
  requisição seguinte. **Não colocar papel no token.**
- **`DUMMY_HASH`** em `signIn` — hash de custo idêntico verificado quando a conta
  não existe. É o que impede enumeração de usuários por tempo de resposta.
- **Throttle no Postgres, não em memória.** O comentário explica: um contador em
  processo é por instância e é contornado espalhando tentativas. Manter no banco.
- **`checkLoginThrottle` falha em aberto**, de propósito: uma indisponibilidade
  do throttle não pode trancar todo mundo fora do produto.
- **bcrypt custo 12.**

## Cabeçalhos e CSP

`next.config.ts` e `src/proxy.ts` estão **exemplares**. HSTS com preload,
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
COOP, CORP, `no-store` universal, CSP com nonce por requisição e
`strict-dynamic`.

Em particular: **não mover a CSP para `next.config.ts`.** Ela precisa do nonce por
requisição, e enviá-la dos dois lugares faz o navegador aplicar a interseção de
duas políticas e quebrar a hidratação — está escrito no comentário.

E **não trocar `style-src 'unsafe-inline'` sem entender o motivo**: `next/font`
emite um `<style>` inline e a UI usa atributos `style`. CSS inline não executa
JavaScript; a diretiva que importa é a de script, e essa está travada.

## Storage

- **Nenhum bucket público, nenhuma URL assinada, tudo pela rota autenticada.**
  Se um dia a entrega global exigir URLs assinadas, é uma **troca consciente**,
  não uma melhoria óbvia.
- **`buildStorageKey`** com `randomUUID()` e namespace por organização/projeto.
- **`resolveKey`** no driver local — proteção contra path traversal.
- **`filename*=UTF-8''`** (RFC 5987) na rota de download. É o que faz
  `产品说明书.pdf` chegar com o nome certo. Poucos projetos acertam isso.

## Camada de dados

- **Agregação por `groupBy` + `Map`**, nunca contagem por linha. Zero N+1 em todo
  o repositório. Manter esse padrão.
- **Singleton do Prisma em `globalThis`** e **instanciação preguiçosa via
  `Proxy`**, com os métodos religados por `.bind()` para preservar o receiver de
  `$transaction`. É engenhoso e resolve um problema real (`next build` sem
  `DATABASE_URL`).
- **`prisma.config.ts` preferindo `DIRECT_URL` para migrations** — advisory locks
  de sessão não existem num pooler em modo transação.
- **`@@unique([documentId, version])`** — é o que transforma a corrida de
  numeração em erro em vez de corrupção.
- **Migrations existentes.** Forward-only. Não editar, não mover, não renomear,
  não reaplicar.

## Testes

- **`tests/unit/scopes.test.ts`** — verifica recursivamente que um escopo de
  fornecedor **nunca menciona outro `supplierId`**. Prova ausência, não só
  presença. É o melhor teste do repositório.
- **`tests/unit/route-structure.test.ts`** — testa uma invariante de framework
  (`loading.tsx` commitando 200 antes de um `notFound()`) que quase ninguém
  pensa em testar.
- **A decisão de usar banco real em vez de mock**, documentada em `ci/README.md`:
  *"mocking them would test the mock instead of the rules."* Correta.

## Produto

- **`/supplier/action-required`** — a home do fornecedor é uma pergunta, não um
  dashboard. É um dos melhores padrões do produto.
- **Estados vazios que distinguem "nada cadastrado" de "nada encontrado"**, em 31
  lugares.
- **Abas e filtros como URLs de verdade** — compartilháveis e corretas no F5.
- **A arquitetura de dois ambientes** sobre um banco só.

## Disciplina do repositório

- **Zero `TODO`/`FIXME`/`HACK`** em todo o código.
- **Zero `console.log`** de depuração em `src/`.
- Comentários que explicam **por quê**, e várias vezes documentam uma decisão
  anterior que deu errado e o motivo. Essa prática deve continuar.
