# 32 — Estratégia de fuso horário

> A pergunta que importa: **um prazo "15 de setembro" é o 15 de setembro de
> quem?** Hoje o sistema não responde isso, e o resultado é que ninguém vê o
> prazo certo.

## O que existe hoje

### Nenhum campo de data é `DATE`. Nenhum é `timestamptz`.

Verificado em `prisma/schema.prisma` e no DDL de
`prisma/migrations/20260902195200_init/migration.sql`: os ~52 campos temporais
são `TIMESTAMP(3)` — *timestamp without time zone*. Não há um único `@db.Date`
nem `@db.Timestamptz` no schema.

### Nenhum usuário tem fuso horário

`model User` tem `language`, `jobTitle`, `department`. Não tem `timezone`.
Não há `TZ` em `.env.example` nem em `next.config.ts`. `src/server/db.ts` não
configura type parsers do `pg`.

### 13 campos são dias de calendário guardados como instante

| Campo | Natureza real | Risco |
|---|---|---|
| `Task.dueDate` | dia | **CRÍTICO** — alimenta toda a regra de atraso |
| `DocumentRequest.dueDate` | dia | **CRÍTICO** — o prazo que o fornecedor vê |
| `Project.targetLaunchDate` | dia | ALTO — data comercial, sai no CSV |
| `ImportShipment.etd` / `.eta` | dia | ALTO — datas portuárias entre fusos |
| `Project.startDate`, `ProjectStage.dueDate`/`.startDate`, `Milestone.dueDate`, `RegulatoryItem.dueDate`, `GtmItem.dueDate`, `ClinicalStudy.startDate`/`.expectedCompletion` | dia | MÉDIO |

## O que salva o sistema hoje — e por que não dá para confiar nisso

A exibição da data **não** desliza para "Sep 14". Existe uma invariante que
funciona, por acidente:

1. Todos os 13 inputs são `<input type="date">` → enviam `"2026-09-15"`.
2. `optionalDate` (`src/server/actions/utils.ts`) faz `new Date("2026-09-15")`.
   Pela especificação do ECMAScript, a forma *date-only* é interpretada como
   **UTC** → `2026-09-15T00:00:00.000Z`.
3. `formatDate`, `formatDateShort` e `formatDeadlineParts` (`src/lib/format.ts`)
   forçam `timeZone: "UTC"`.

UTC na entrada, UTC na saída. O dia sobrevive.

**Mas essa invariante não está escrita em lugar nenhum, não tem teste, e já está
quebrada em um ponto:**

### GLB-001 — `formatDateTime` não fixa fuso · **HIGH**

`src/lib/format.ts` — é a única das cinco funções de formatação **sem**
`timeZone: "UTC"`:

```ts
export function formatDateTime(value, locale = "pt-BR") {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    // ← sem timeZone
  }).format(date);
}
```

Usada em `src/features/messages/thread-view.tsx` e
`src/app/(supplier)/supplier/action-required/[requestId]/page.tsx` — ambos
Server Components. Logo, o horário renderizado é o do **servidor**, não o do
leitor, e não vem rotulado com o fuso.

Um fornecedor em Xangai lê horários de mensagem e de submissão com 8 horas de
defasagem, sem nada na tela que indique isso.

## GLB-002 — "Atrasado" é calculado no fuso do servidor · **CRITICAL**

Este é o achado mais consequente da dimensão global.

**Evidência:**

`src/lib/format.ts`, `daysUntil` — usa meia-noite **local do runtime**:
```ts
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
```

`src/lib/status.ts`, `deriveTaskStatus` e `src/server/services/project-health.ts`,
`isOverdue` — comparam instantes: `dueDate.getTime() < now.getTime()`.

Nas consultas, o mesmo: `dueDate: { lt: new Date() }` em
`src/server/services/tasks.ts`, `suppliers.ts` e `dashboard.ts`.

**O que acontece na prática** com `DocumentRequest.dueDate = 2026-09-15T00:00:00Z`:

| Onde | Quando vira "Atrasado" | O que o usuário vê |
|---|---|---|
| Xangai (UTC+8) | 15/09 às **08:00 da manhã local** | vermelho "已逾期 / Overdue" durante todo o dia útil em que o prazo ainda corre |
| Munique (UTC+2) | 15/09 às 02:00 local | quase o dia inteiro marcado errado |
| São Paulo (UTC−3) | **14/09 às 21:00** local | atrasado um dia antes |

**Nenhum dos três está certo, e os três discordam entre si.**

Pior: `deriveProjectStatus` (`src/server/services/project-health.ts`) promove o
projeto a `AT_RISK` com base nessa mesma comparação. O erro de fuso contamina o
status do portfólio inteiro, que é o número que a diretoria olha.

`daysUntil` é chamada em 8 pontos, três deles no portal do fornecedor —
`(supplier)/supplier/action-required/(index)/page.tsx`, `.../[requestId]/page.tsx`
e `.../projects/[projectId]/action-required/page.tsx` — que decidem entre
`overdue`, `dueToday` e `dueInDays`.

## GLB-003 — Saudação calculada no servidor · **LOW**

`src/app/(supplier)/supplier/(home)/page.tsx` chama
`greetingKey(new Date().getHours())` dentro de um Server Component. Às 23:00 em
Xangai (15:00 UTC) o fornecedor é saudado com *"Good afternoon"*.

Sintoma pequeno, mesma causa raiz.

## Estratégia recomendada

**Nada aqui foi implementado. É proposta, para aprovação.**

### Regra 1 — Separar instante de dia

| Conceito | Tipo | Exemplos |
|---|---|---|
| **Instante** — um momento que aconteceu | `@db.Timestamptz` | `createdAt`, `updatedAt`, `submittedAt`, `reviewedAt`, `completedAt`, `lastLoginAt`, `AuditLog.createdAt`, `Message.createdAt` |
| **Dia de calendário** — uma data acordada entre pessoas | `@db.Date` | `dueDate`, `targetLaunchDate`, `startDate`, `etd`, `eta`, `expectedCompletion` |

Um prazo não é um instante. "Entregar até 15 de setembro" é um acordo sobre um
dia, não sobre um microssegundo. Guardar como `DATE` elimina a classe inteira de
bugs, porque não existe fuso a interpretar.

### Regra 2 — Definir oficialmente o significado de um prazo

Três opções. **A escolha é de negócio, não de engenharia:**

| Opção | Significado | A favor | Contra |
|---|---|---|---|
| **A — Fuso da Vionex** | vence às 23:59:59 em São Paulo | um só relógio; a equipe interna vê o que espera | o fornecedor chinês perde ~11 h do último dia |
| **B — Fuso do fornecedor** | vence às 23:59:59 no fuso do fornecedor | justo com quem precisa cumprir | exige `Supplier.timezone`; a Vionex vê prazos vencendo em horários estranhos |
| **C — Fim do dia em UTC−12** | o dia acaba quando acabou em todo lugar | ninguém é prejudicado; regra simples | dá até 12 h a mais de folga |

**Recomendação: opção B**, com `Supplier.timezone` (IANA, ex.: `Asia/Shanghai`)
e exibição que diga o fuso: *"Due Sep 15 (Asia/Shanghai)"*. É a única que é
justa com quem tem a obrigação, e a plataforma existe para cobrar fornecedores.

### Regra 3 — Fuso de exibição por usuário

Acrescentar `User.timezone` (IANA, default `America/Sao_Paulo` para internos e o
do fornecedor para o portal). Todo instante é formatado nesse fuso, **sempre com
o rótulo do fuso visível**. Nenhuma função de formatação sem `timeZone` explícito.

### Regra 4 — Uma única função para "está atrasado?"

Hoje a decisão está espalhada por `daysUntil`, `deriveTaskStatus`, `isOverdue` e
três `where` do Prisma. Devem colapsar numa função só, que receba o fuso e
compare **dias**, não instantes.

### Regra 5 — Fixar `TZ=UTC` no servidor

Garante que o comportamento em produção seja igual ao do desenvolvimento e
elimina a dependência do fuso da máquina.

### Regra 6 — Testar

Nenhum teste em `tests/` menciona `timeZone`, `daysUntil` ou `formatDate`.
A matriz mínima está em [36_GLOBAL_TEST_MATRIX.md](36_GLOBAL_TEST_MATRIX.md):
sete fusos × datas próximas à meia-noite × horário de verão.

## Ordem de execução

Esta mudança **toca migrations e dados existentes**. A sequência segura é:

1. Validar backup e restore ([16_BACKUP_AND_RESTORE.md](16_BACKUP_AND_RESTORE.md)) — **pré-requisito absoluto**.
2. Decidir a semântica do prazo (opção A, B ou C) — decisão de negócio.
3. Migration *forward-only* acrescentando `User.timezone` e `Supplier.timezone`.
4. Migration convertendo os 13 campos de dia para `DATE` — com conversão
   explícita `AT TIME ZONE`, nunca com cast implícito.
5. Converter os ~39 instantes para `timestamptz`.
6. Unificar o cálculo de atraso.
7. Suíte de testes de fuso antes de promover qualquer coisa.

Nenhuma dessas etapas deve começar antes da etapa 1.
