# 34 — Residência de dados

## Estado: não há decisão registrada

| Componente | Região | Como está definida |
|---|---|---|
| Aplicação | indefinida | painel da Vercel, sem `vercel.json` versionado |
| Banco | **nenhum** | roda em memória dentro da função (DB-007) |
| Storage | **nenhum** | `local`, dentro da função, efêmero |
| Logs | região da Vercel | não configurado |
| Backups | **não existem** | — |
| Analytics | n/a | não há |
| E-mail | n/a | não é enviado |

`STORAGE_REGION` tem default `us-east-1` em `src/lib/env-schema.ts` — um default
que, se não for revisto, coloca documentos de fornecedores alemães e italianos
nos Estados Unidos por omissão.

## Por que isso importa aqui

Titulares de dados pessoais em pelo menos quatro jurisdições: Brasil (LGPD),
Alemanha e Itália (GDPR), Estados Unidos, China (PIPL).

**Nenhuma avaliação jurídica é feita neste documento.** Os pontos abaixo são
requisitos técnicos que costumam acompanhar essas normas, todos marcados
**LEGAL REVIEW REQUIRED**.

## Perguntas em aberto

| # | Pergunta | Quem decide |
|---|---|---|
| 1 | Onde os documentos de fornecedores podem ficar fisicamente? | jurídico + negócio |
| 2 | Há contrato com fornecedor europeu que exija dados na UE? | jurídico |
| 3 | A PIPL se aplica aos dados do fornecedor chinês guardados fora da China? | jurídico |
| 4 | Transferência internacional exige cláusulas contratuais padrão? | jurídico |
| 5 | Backups podem ficar em região diferente da primária? | jurídico |
| 6 | Logs contendo IP (`LoginAttempt.key`) são dado pessoal sujeito a residência? | jurídico |

## Recomendação técnica

Enquanto as perguntas não forem respondidas, a escolha conservadora é
**concentrar tudo numa região só** — aplicação, banco, storage, backup — e
registrar essa escolha em `vercel.json` versionado e no `.env.example`, para que
seja revisável.

A alternativa que a arquitetura permite é separar por fornecedor: `Supplier`
ganharia uma coluna de região e os documentos iriam para buckets distintos. Isso
é uma mudança de arquitetura considerável e **não deve ser feita sem a decisão
jurídica primeiro**.

## Mapa mínimo a produzir depois da decisão

Ver [33_GLOBAL_DATA_FLOW.md](33_GLOBAL_DATA_FLOW.md).
