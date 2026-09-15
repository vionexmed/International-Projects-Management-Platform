# Auditoria Vionex Projects

Auditoria técnica completa realizada em **14 de setembro de 2026** sobre o commit
`af823ff` do repositório `vionexmed/International-Projects-Management-Platform`.

## O que esta auditoria é

Um levantamento de evidências. Cada afirmação relevante aponta para um arquivo
real do repositório. Onde não foi possível confirmar algo pela leitura do
código, isso está registrado em [38_UNRESOLVED_QUESTIONS.md](38_UNRESOLVED_QUESTIONS.md)
em vez de ser preenchido com suposição.

## O que esta auditoria não é

Não houve implementação. Nenhum arquivo de código, schema, migration,
configuração, secret ou infraestrutura foi alterado. Nenhum comando de banco foi
executado contra qualquer ambiente. Os únicos arquivos criados são os desta
pasta.

## Por onde começar

| Se você quer… | Leia |
|---|---|
| A resposta curta | [00_EXECUTIVE_SUMMARY.md](00_EXECUTIVE_SUMMARY.md) |
| O que impede produção | [15_PRODUCTION_READINESS.md](15_PRODUCTION_READINESS.md) |
| O que impede uso internacional | [30_GLOBAL_READINESS.md](30_GLOBAL_READINESS.md) |
| A lista de riscos priorizada | [23_RISK_REGISTER.md](23_RISK_REGISTER.md) |
| O caminho até produção | [26_MASTER_IMPLEMENTATION_PLAN.md](26_MASTER_IMPLEMENTATION_PLAN.md) — **revisão 2**, com A0/A1/A2 e rodadas |
| A evidência de qualquer achado | [39_EVIDENCE_INDEX.md](39_EVIDENCE_INDEX.md) |
| As notas por dimensão | [40_SCORECARD.md](40_SCORECARD.md) |
| O que não deve ser mexido | [37_DO_NOT_TOUCH.md](37_DO_NOT_TOUCH.md) |

## Histórico

| Data | O que mudou |
|---|---|
| 14/09/2026 | Auditoria original. 42 documentos. |
| 15/09/2026 | **Revisão 2 do plano.** Fase A dividida em A0/A1/A2; `APP_ENV` explícito; fail-fast em ambientes reais; demo declarado e nunca inferido; liveness separado de readiness; contrato de teste por invariante; rodadas por *blast radius*. Documentos alterados: `26`, `27`, `15`, `17`, `38`, este. **Nenhum código foi tocado.** |

## Convenções

**Severidade** — CRITICAL (exploração leva a comprometimento total ou perda de
dados), HIGH (impacto sério e caminho plausível), MEDIUM (impacto real mas
limitado ou improvável), LOW (higiene), INFO (observação).

**Status da evidência** — CONFIRMED (lido no código), PARTIALLY CONFIRMED
(indício forte, falta uma verificação em ambiente real), NOT CONFIRMED
(hipótese registrada para investigação).

**IDs** — `SEC-`, `AUTH-`, `TEN-` (multitenancy), `DB-`, `STO-` (storage),
`ARCH-`, `OPS-`, `UX-`, `GLB-` (global readiness), `GOV-` (governança).
