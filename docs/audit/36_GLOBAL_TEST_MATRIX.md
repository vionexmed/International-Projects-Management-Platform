# 36 — Matriz de testes globais

> Nenhum destes testes existe hoje. `tests/` não contém nenhuma referência a
> `locale`, `timeZone`, `dictionary`, `daysUntil` ou `formatDate`.

## Fusos

| Fuso | Offset | Por quê |
|---|---|---|
| `America/Sao_Paulo` | UTC−3 | sede da Vionex |
| `America/New_York` | UTC−5/−4 | fornecedor americano; **tem horário de verão** |
| `Europe/London` | UTC+0/+1 | referência; tem horário de verão |
| `Europe/Berlin` | UTC+1/+2 | fornecedor alemão |
| `Europe/Rome` | UTC+1/+2 | fornecedor italiano |
| `Asia/Shanghai` | UTC+8 | fornecedor chinês; **sem horário de verão** |
| `Asia/Tokyo` | UTC+9 | expansão |
| `Australia/Sydney` | UTC+10/+11 | **horário de verão invertido** — o caso que quebra suposições |

## Casos de data que precisam passar

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Prazo 15/09, visto em Xangai às 09:00 de 15/09 | **"vence hoje"**, nunca "atrasado" |
| 2 | O mesmo, visto em São Paulo às 22:00 de 14/09 | **"vence amanhã"**, nunca "atrasado" |
| 3 | O mesmo, visto em Sydney às 08:00 de 16/09 | "atrasado há 1 dia" |
| 4 | Projeto criado 31/12 às 23:30 em São Paulo | aparece como 31/12, **não** 01/01 |
| 5 | Mensagem enviada 15/09 às 09:00 de Xangai, lida em Munique | horário **rotulado com o fuso** |
| 6 | Prazo no domingo de mudança de horário de verão em Berlim | sem salto de um dia |
| 7 | O mesmo em Sydney (verão invertido) | idem |
| 8 | 29/02 de 2028 | sem erro |
| 9 | Data exibida por `formatDate` e por `formatDateTime` no mesmo registro | **o mesmo dia** — hoje podem divergir (GLB-001) |
| 10 | `daysUntil` com o servidor em `TZ=UTC` e em `TZ=America/Sao_Paulo` | **o mesmo resultado** |

Os casos 1, 2 e 3 **falham hoje**. Ver GLB-002.

## Locales

| Locale | Cobertura esperada |
|---|---|
| `pt-BR` | ambiente interno completo |
| `en-US` | Supplier Portal completo, **incluindo a tela de login** |
| `en-GB` | formato de data `15/09/2026`, não `09/15/2026` |
| `zh-CN` | Supplier Portal, com tipografia CJK |

## Casos de idioma que precisam passar

| # | Caso | Hoje |
|---|---|---|
| 1 | Fornecedor `en` abre `/login` | **falha** — a tela é toda em português (GLB-012) |
| 2 | Fornecedor `en` submete resposta vazia | **falha** — erro em português (GLB-013) |
| 3 | Fornecedor `en` envia arquivo de tipo inválido | **falha** — erro em português |
| 4 | Fornecedor `en` abre o histórico do projeto | **falha** — timeline em português (GLB-014) |
| 5 | Fornecedor `en` cai num 404 | **falha** — página em português apontando para `/dashboard` |
| 6 | Fornecedor `zh` vê a paginação | **falha** — `共 12 个项目 条`, classificador duplicado |
| 7 | Fornecedor `zh` vê a interface | **falha** — sem fonte CJK, sob `lang="pt-BR"` |
| 8 | Buscar `São` digitando `sao` | **falha** — `ILIKE` não dobra acento |
| 9 | Buscar um ideograma Han | **falha** — gate de 2 caracteres |
| 10 | Baixar `产品说明书.pdf` | **passa** — `filename*=UTF-8''` está correto |
| 11 | Abrir o CSV exportado no Excel com acentos | **passa** — BOM presente |
| 12 | Ordenar fornecedores chineses por nome | ordena por code point |

## Condições de rede

| Condição | Como | O que verificar |
|---|---|---|
| Rápida | 100 Mbps | linha de base |
| Alta latência | +400 ms RTT | tempo até interativo |
| Upload lento | 1 Mbps, arquivo de 20 MB | **existe indicação de progresso?** (UX-002 — hoje não) |
| Queda temporária | desligar no meio do upload | **o formulário sobrevive?** (UX-001 — hoje não) |
| Download interrompido | desligar no meio | retoma ou recomeça? |

Os dois casos marcados são os mais importantes de toda esta matriz: são o momento
em que um fornecedor decide se a plataforma é utilizável.

## Dispositivos

| Largura | Verificar |
|---|---|
| 360 px | já verificado nesta sessão: nenhuma página empurra a tela de lado |
| 390 px | idem |
| 768 px | **descontinuidade**: o portal troca para desktop em `md`, o interno só em `lg` |
| 1440 px | linha de base |

Casos específicos ainda abertos no celular: o fornecedor **não consegue sair nem
trocar de idioma** (UX-012), e o gatilho da paleta de comandos fica **sem nome
acessível** abaixo de 640 px (UX-007).
