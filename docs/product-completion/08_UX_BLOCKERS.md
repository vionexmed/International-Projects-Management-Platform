# 08 — Bloqueadores de experiência

## Corrigidos nesta rodada

### UX-001 · O formulário era apagado quando a ação falhava

A causa **não estava no nosso código**. Está no React, em `startHostTransition`:

```js
null === action ? noop : function () {
  requestFormReset$1(formFiber);   // ← agendado ANTES da ação
  return action(formData);
}
```

O reset é pedido antes da ação e commita quando a transição termina — **qualquer
que tenha sido o retorno**. As actions deste projeto reportam falha
**retornando** `{ error }` em vez de lançar, então a transição sempre termina
com sucesso e o formulário sempre era limpo.

**Correção:** `src/components/app/use-form-action.ts` conduz a transição a partir
do `onSubmit`, o que pula esse wrapper inteiro. Os campos sobrevivem à falha; a
limpeza passou a ser explícita, no sucesso.

**Custo assumido:** `useFormStatus` deixa de enxergar uma form action; o
`pending` agora desce como prop. Uma troca barata.

### UX-002 · Upload sem sinal de progresso

Uma server action não carrega evento de progresso, então **não existe
porcentagem honesta a mostrar**. O que dá para dar, e foi dado: um estado
explícito (*"Enviando… mantenha esta aba aberta até a confirmação"*), o botão com
texto de verdade em vez de `"…"`, e os campos travados durante o envio.

Progresso real por byte exigiria trocar a submissão por XHR contra um route
handler. Registrado como **P2** — não é necessário para fechar o core.

### UX-003 · Arquivo fantasma

A zona de arquivo guardava o arquivo em estado React **e** no input nativo.
`form.reset()` limpava só o segundo, então a zona continuava exibindo um arquivo
que não estava mais anexado — e um segundo envio mandava nada.

**Correção:** o componente é remontado por `key` no sucesso. Remontar é o único
reset que não deixa as duas cópias discordando. (A primeira tentativa foi um
`useEffect` com `setState`; o lint acusou, e com razão.)

### UX-012 · Fornecedor sem saída no celular

Idioma e "sair" existiam apenas na sidebar `hidden md:flex`. Num celular, o
fornecedor não conseguia trocar o idioma de um portal que talvez não leia, nem
sair de um aparelho compartilhado. Ambos foram para o menu.

---

## Abertos

### P1

| # | Bloqueador | Onde |
|---|---|---|
| **UX-A** | **Listas truncadas em silêncio** — `perPage: 100`/`50` sem paginação em 5 telas. O rodapé chega a dizer "Showing 1 to 50 of 120" e as outras 70 são inalcançáveis | `/supplier/documents`, `/supplier/projects`, `/projects/[id]/{tasks,documents,regulatory}` |
| **UX-B** | **16 rotas sem `loading.tsx`**, incluindo as 9 abas de projeto — cada uma com 2 a 4 consultas em paralelo. Trocar de aba não produz nenhum sinal | — |
| **UX-C** | **Três afordâncias que mentem** — o ícone de mensagens vai para projetos, o sino do portal vai para Action Required, e os itens do menu do projeto só navegam | `topbar.tsx`, `supplier/layout.tsx`, `project-actions-menu.tsx` |
| **UX-D** | **404 do fornecedor cai em página portuguesa** que oferece "Voltar ao dashboard" — rota da qual ele é redirecionado de volta | `app/not-found.tsx` |

### P2

| # | Bloqueador |
|---|---|
| **UX-E** | Foco de teclado praticamente invisível — menus a 1,09:1, anel de input a 1,18:1, paleta de comandos sem substituto |
| **UX-F** | `text-faint` a 2,79:1 sobre o canvas: é o placeholder de **todos** os campos, todos os timestamps e o e-mail no menu de conta |
| **UX-G** | `<html lang="pt-BR">` para todo o produto, inclusive o portal em inglês |
| **UX-H** | Gatilho da paleta de comandos **sem nome acessível** abaixo de 640px, nos dois ambientes |
| **UX-I** | Classes de animação declaradas sem o plugin instalado — diálogos e menus aparecem secamente |
| **UX-J** | Progresso real de upload (XHR contra route handler) |

### P3

Duas escalas tipográficas colidindo (363 valores arbitrários), quatro
implementações do mesmo contador, cinco cópias manuais do cabeçalho de detalhe,
e `formatDateTime` sem fuso fixo enquanto `formatDate` fixa UTC.

---

## O que **não** deve ser feito

Redesign. A direção visual está cumprida e aprovada: paleta restrita, zero
gradiente, profundidade por *hairline*, `tabular-nums`. As lacunas acima são
funcionais e de acessibilidade — **nenhuma delas pede um card novo, uma cor nova
ou um elemento decorativo.**
