# 10 — Auditoria de frontend e exposição de dados

## A regra

> O DevTools não deve mostrar informação que aquele usuário não deveria possuir.

## O que chega ao navegador

41 componentes cliente. A fronteira está bem colocada: **as páginas em
`src/app/**` são todas Server Components**, e os componentes cliente recebem
dados por props.

**Verificado:** nenhum componente cliente importa Prisma, `@/server/**` ou
`@/lib/env`. Os guards `import "server-only"` em `src/server/**` e em
`src/lib/storage/index.ts` reforçam isso no build.

**`passwordHash` nunca sai do servidor.** É selecionado apenas em
`src/server/actions/auth.ts` → `signIn`, e `getCurrentUser` não o inclui no
`select`.

## FE-001 — Campos internos no payload RSC do fornecedor · **HIGH**

É TEN-002, visto do lado do frontend, e é o achado que responde exatamente à
pergunta desta fase.

`getProjectWorkspace` devolve linhas completas de `ProjectStage` e `Milestone`.
Como a página do portal é um Server Component, **tudo é serializado no payload
RSC e fica legível no DevTools — mesmo que a interface não renderize o campo**.

`ProjectStage.notes`, `Project.blockerNote`, `Project.description` e
`Milestone.description` chegam ao navegador do fornecedor.

Este é o caso exemplar da regra: **ocultar no frontend não é autorização.** E
aqui nem há ocultação deliberada — apenas ausência de renderização.

## FE-002 — `SessionUser` inteiro vai para a sidebar · **LOW**

`src/app/(internal)/layout.tsx` e `src/app/(supplier)/supplier/layout.tsx` passam
`user={user}` para componentes cliente. O objeto inclui `id`, `email`,
`organizationId` e `supplierId`.

A sidebar precisa de `name`, `role` e `supplierName`. Os identificadores internos
não são segredo — o servidor reescopa tudo de qualquer forma — mas o princípio da
exposição mínima recomendaria um DTO.

## O que **não** vaza

| Verificação | Resultado |
|---|---|
| `passwordHash` em componente | **nenhuma ocorrência** |
| Token de sessão acessível por JS | **não** — cookie `httpOnly` |
| Segredo ou chave de API no bundle | **nenhum** — nenhuma variável `NEXT_PUBLIC_*` existe |
| Chave de storage exposta | **não** — o cliente endereça arquivos por `versionId` |
| Dados ocultos por CSS que deveriam estar ausentes | **não encontrado** além de FE-001 |
| Import de Prisma em componente cliente | **nenhum** |

## Cache do navegador

`next.config.ts` envia `Cache-Control: private, no-store, max-age=0` em toda
página e rota de API, exceto assets estáticos. A rota de arquivos reforça com
`private, no-store`. Correto para dados específicos do usuário.

## Bundle

`lucide-react` importado em praticamente todos os 41 componentes cliente —
aceitável com tree-shaking. `date-fns` **não** entra no cliente (a formatação
vive em `src/lib/format.ts`, usada no servidor). `sonner` e `react-hook-form`
têm escopo de formulário.

Candidatos a Server Component: `project-tabs.tsx` e `supplier-project-tabs.tsx`,
se forem apenas navegação baseada em rota.
