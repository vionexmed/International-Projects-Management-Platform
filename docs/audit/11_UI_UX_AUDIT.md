# 11 — Auditoria de UI/UX e acessibilidade

| Dimensão | Nota |
|---|---:|
| UI | 7,5 |
| UX | 6,5 |
| Acessibilidade | 5,0 |
| Design System | 6,0 |

## UX-001 — O formulário é apagado quando a ação falha · **CRITICAL**

**Verificado no fonte do React**, em
`node_modules/react-dom/cjs/react-dom-client.development.js`, `startHostTransition`:

```js
startTransition(formFiber, queue, pendingState, NotPendingTransition,
  null === action ? noop : function () {
    requestFormReset$1(formFiber);   // ← agendado ANTES da ação
    return action(formData);
  }
);
```

`requestFormReset` é chamado **incondicionalmente, dentro do wrapper, antes da
ação**. O reset commita quando a transição termina — independentemente do que a
ação retornou.

As actions deste projeto **nunca lançam**: retornam `{ error }`
(`src/server/actions/utils.ts` → `toActionError`). Logo a transição termina com
sucesso, o erro é exibido **e o formulário é zerado junto**.

No diálogo de novo projeto (12 campos) ou no `SubmitRequestForm` do fornecedor,
todo o trabalho evapora ao lado da mensagem "Verifique os campos destacados."

Para um fornecedor em Xangai com conexão instável, essa é a pior combinação
possível: o upload falha, a nota digitada some, e o arquivo selecionado some.

## UX-002 — Upload sem indicação de progresso · **HIGH**

`src/features/supplier-portal/submit-request-form.tsx`. Server Action com
`FormData` não expõe eventos de progresso. O único sinal é o botão virar
`"…"` — literalmente um ellipsis, sem palavra. O rótulo "Submit" desaparece.

Público declarado: fabricantes na China, arquivos de até 25 MB. É o momento de
maior risco de abandono do produto inteiro.

## UX-003 — Arquivo fantasma após o envio · **HIGH**

`src/components/app/file-dropzone.tsx` guarda o arquivo em estado React e o
`<input type="file">` em paralelo. Após o sucesso, `formRef.current?.reset()`
limpa o input nativo mas **não** o estado. A zona continua mostrando o nome do
arquivo antigo, como se ainda estivesse anexado, enquanto o input está vazio —
um segundo envio manda nada.

## Contraste — a matemática

Método WCAG: `L = 0.2126R + 0.7152G + 0.0722B` sobre canais linearizados;
`ratio = (L₁+0.05)/(L₂+0.05)`.

| Par | Razão | Exige | Veredito |
|---|---:|---:|---|
| `ink` / `surface` | 16,50 | 4,5 | ✅ |
| `ink-soft` / `surface` | 8,70 | 4,5 | ✅ |
| `muted` / `surface` | 4,60 | 4,5 | ✅ margem 0,10 |
| **`muted` / `canvas`** | **4,36** | 4,5 | ❌ descrição de **toda** `PageHeader` interna |
| **`muted` / `subtle`** | **4,48** | 4,5 | ❌ **`.table-label`**, cabeçalho de **toda** tabela |
| **`muted` / `raised`** | **4,20** | 4,5 | ❌ |
| **`faint` / `surface`** | **2,95** | 4,5 | ❌ |
| **`faint` / `canvas`** | **2,79** | 4,5 | ❌ |
| `brand-strong` / `surface` | 5,82 | 4,5 | ✅ |
| branco / `brand-strong` (botão) | 5,82 | 4,5 | ✅ |
| **`brand` / `canvas`** (anel de foco) | **2,85** | 3,0 | ❌ |
| **`ok` / `surface`** (badge "Em dia") | **4,33** | 4,5 | ❌ |
| **`ok` / `ok-soft`** (SolidBadge, 12px) | **3,89** | 4,5 | ❌ |
| `warn` / `surface` | 5,31 | 4,5 | ✅ |
| `risk` / `surface` | 6,58 | 4,5 | ✅ |
| `navy-ink` / `navy` (sidebar) | 7,06 | 4,5 | ✅ |
| **`line` / `surface`** (borda de Input) | **1,27** | 3,0 | ❌ |
| **`raised` / `surface`** (item destacado em menu) | **1,09** | 3,0 | ❌ |
| **`brand/15%`** (anel de foco de input) | **1,18** | 3,0 | ❌ |

**Onze pares falham.** O mais disseminado é `text-faint` (2,79:1): é o
placeholder de **todo** campo do produto, todos os timestamps, o e-mail no menu
de conta, o `kbd ⌘K` e o rodapé.

## UX-008 — Foco de teclado praticamente invisível · **HIGH**

A regra global existe e é boa:
`:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px }`.

**Mas é anulada exatamente onde mais se navega:**

| Onde | O que acontece |
|---|---|
| `src/components/ui/input.tsx` (×3) | `focus:outline-none` trocado por anel a **1,18:1**. E é `focus:`, não `focus-visible:` — dispara no clique de mouse |
| `src/components/app/search-filters.tsx` | mesmo padrão |
| **`src/components/app/command-palette.tsx`** | `focus:outline-none` **sem nenhum substituto** |
| `src/components/ui/dropdown.tsx` | `outline-none` incondicional; destaque só por `bg-raised` = **1,09:1**. Navegar o menu de conta com setas é invisível |

O único uso correto de `focus-visible` em todo o `src/` é
`src/components/ui/checkbox.tsx`.

## Outros achados de acessibilidade

| # | Achado | Evidência |
|---|---|---|
| **UX-006** | `<html lang="pt-BR">` para **todo** o produto, inclusive o portal em inglês e o dicionário `zh`. WCAG 3.1.1 | `src/app/layout.tsx` |
| **UX-007** | **O gatilho da paleta de comandos fica sem nome acessível abaixo de 640px** — os dois `<span>` de texto são `hidden sm:inline` e resta só um `<svg>` sem `title`. Nos dois ambientes. WCAG 4.1.2 | `src/components/app/command-palette.tsx` |
| **UX-021** | **Nenhum skip link.** 14+ Tabs até o conteúdo, em toda navegação | os dois layouts |
| **UX-022** | Erros de campo sem `aria-invalid` nem `aria-describedby` — a mensagem é irmã do input | `Field` em `form-dialog.tsx` |
| **UX-023** | `<Label htmlFor="file">` **órfão** — o input real dentro do dropzone é `sr-only` **sem `id`**. E continua focável, invisível e sem anel | `file-dropzone.tsx` |
| **UX-024** | 13 tabelas **sem `<caption>`** nem nome acessível; a matriz de permissões não usa `<th scope="row">` | `ui/table.tsx`, `settings/page.tsx` |
| **UX-032** | `Checkbox` 16×16 falha SC 2.5.8 (24px) | `ui/checkbox.tsx` |

## O que está correto — e foi verificado, não assumido

| Hipótese testada | Resultado |
|---|---|
| `onClick` em `div`/`span`/`li` | **zero ocorrências.** Os 19 `onClick` estão todos em `<button>` ou `<Button>` |
| Páginas sem `h1` ou com dois | **nenhuma.** Exatamente um `h1` nas 32 rotas |
| `prefers-reduced-motion` ignorado | **implementado corretamente**, fora de `@layer`, com `!important` |
| `alt` ausente | há uma única `<Image>` no produto e ela tem `alt` |
| Botões só-ícone sem rótulo | todos com `aria-label`, exceto UX-007 |
| Landmarks | `main`, `nav aria-label`, `aside`, `header`, `footer` presentes |
| `TH scope="col"` | em todas as tabelas |

## Afordâncias que mentem

| # | O que promete | O que faz |
|---|---|---|
| **UX-014** | ícone "Mensagens (3 não lidas)" no topbar | navega para `/projects`. **Não existe tela de mensagens no ambiente interno** |
| **UX-015** | sino do portal, `aria-label="Notifications"`, contador de `countUnread` | navega para `/supplier/action-required`. Rótulo, contador e destino são três coisas diferentes |
| **UX-016** | menu do projeto: "Solicitar documento", "Enviar documento" | são `<Link>` que só navegam para a aba; o usuário ainda precisa achar o botão real |
| **UX-011** | rodapé "Showing 1 to 50 of 120" | **sem paginação** — as outras 70 são inalcançáveis. Em 5 telas |

## UX-012 — O fornecedor no celular não consegue sair nem trocar de idioma · **HIGH**

`LanguagePicker` e o menu de conta (com "Log out") existem **apenas** em
`supplier-sidebar.tsx`, que é `hidden md:flex`. `supplier-mobile-nav.tsx` tem só
os 5 links de navegação.

## Estados de carregamento

`error.tsx` cobre 100% das rotas. `loading.tsx` cobre 12 de 32 — e **nenhuma das
16 rotas de detalhe**, que são justamente as mais pesadas (as 9 abas de projeto
fazem 2 a 4 consultas em paralelo cada).

Detalhe: `supplier/action-required/(index)/loading.tsx` usa `TablePageSkeleton`,
mas a página real renderiza **cartões**. O esqueleto não corresponde à página.

## Design system

**36 tokens de cor, 4 de raio, 2 de fonte. Nenhum token de tipografia,
espaçamento ou sombra** — justamente as três dimensões onde se acumulam **363
valores arbitrários em 75 dos 119 arquivos**:

```
text-[13px] 167×   text-[11px] 30×   text-[12px] 25×   text-[15px] 11×
```

Existe uma **segunda escala tipográfica de fato**, colidindo com a primeira:
12px é escrito como `text-xs` **e** `text-[12px]`; 14px como `text-sm` **e**
`text-[14px]`. A escala efetiva tem 12 degraus, nenhum tokenizado.

O par `text-[11px] font-semibold tracking-[0.06em] uppercase text-muted` é
reescrito **9 vezes** — enquanto `.table-label` em `globals.css` já é exatamente
esse estilo.

### UX-025 — Animações declaradas que não existem · **MEDIUM**

`dialog.tsx` e `dropdown.tsx` usam `animate-in`, `fade-in-0`, `zoom-in-95`,
`slide-in-from-right`. Essas classes vêm do plugin `tailwindcss-animate`.
**O plugin não está instalado** e `globals.css` não tem `@plugin`. Tailwind v4
não as fornece nativamente.

Resultado: modais e menus aparecem sem nenhuma transição, e o código de animação
é letra morta.

### Código morto no design system

`DrawerContent`, `CountBadge`, `Button variant="danger"`, prop `breadcrumb` do
`Topbar`, prop `action` do `EmptyState` — todos sem uso. E **8 pacotes Radix
instalados e nunca importados** (`react-popover`, `react-scroll-area`,
`react-select`, `react-tabs`, `react-tooltip`, `react-avatar`, `react-progress`,
`react-separator`).

## Inconsistências concretas

1. **Duas formas de abrir uma linha**: link esticado (`after:absolute inset-0`) em 5 telas versus `block hover:underline` no dashboard — onde a linha inteira faz hover mas só o título clica.
2. **Quatro implementações do mesmo contador**, enquanto `CountBadge` existe e não é usado.
3. **Dois formatos de data no mesmo registro**: `formatDate` fixa UTC, `formatDateTime` não. A mesma `createdAt` pode aparecer como dias diferentes em telas diferentes.
4. **Três formas de exprimir atraso**: `"{n}d atrasado"`, `"({n}d)"`, `"· atrasado"`, `"· {n}d"`.
5. **Três estilos de badge para o mesmo status**, e a coluna "Status" vira ponto ou dropdown conforme o papel, sem explicação.
6. **Cinco cópias manuais do cabeçalho de detalhe**, uma delas com tamanho divergente (24px vs 26px).
7. **Constantes de `<option>` duplicadas em 7 arquivos**, em ordens diferentes e com defaults diferentes — enquanto `OPTIONS` + `label()` já existem e são usados nos filtros.
8. **Dois botões "Log out"** na mesma sidebar do fornecedor.

## O que está genuinamente bem feito

- A home do fornecedor é uma **pergunta** ("o que você precisa fazer"), não um dashboard. `/supplier/action-required` é um dos melhores padrões do produto.
- Estados vazios distinguem "nada cadastrado" de "nada encontrado com este filtro" e mudam a descrição — em 31 lugares.
- Abas e filtros são **URLs de verdade**: compartilháveis e corretas no F5.
- `InlineStatusSelect` com `useOptimistic` + `useTransition`.
- A estética declarada foi cumprida: paleta restrita, zero gradiente, profundidade por *hairline*, `tabular-nums` no body, tracking negativo nos títulos.
