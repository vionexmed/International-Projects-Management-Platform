# Arquitetura de deploy

Recomendação. **Nada foi criado** — nem projeto Vercel, nem staging, nem
produção.

## Ambientes e branches

| Ambiente | Origem | Banco | Storage | APP_ENV |
|---|---|---|---|---|
| development | máquina local | Postgres local ou embutido | local | `development` |
| test / CI | GitHub Actions | Postgres de serviço, descartável | local | `test` |
| demo | branch `demo` ou deploy próprio | banco Supabase **separado** | bucket separado | `demo` |
| preview | toda pull request | banco de **staging** | bucket de staging | derivado (`preview`) |
| staging | branch `main` | Supabase staging | bucket staging | `staging` |
| production | promoção manual de `main` | Supabase production | bucket production | `production` |

Um projeto Vercel só, com os três ambientes nativos (Development, Preview,
Production) e as variáveis escopadas por ambiente. Staging como um segundo
projeto apontando para `main`, ou como *branch de produção* separada —
decisão sua, ver `08_PRODUCTIONIZATION_PLAN.md`.

**Preview nunca aponta para o banco de produção.** Um preview é uma URL
compartilhável, às vezes indexável por acidente, construída do mesmo código —
tratá-lo como playground é como uma porta "temporária" vira permanente.

## Migrations no deploy

**Não** rodar `migrate deploy` no comando de build. O build acontece em
paralelo em várias máquinas e sem as variáveis do ambiente alvo; migration é
um ato único, ordenado e com lock.

Recomendado: passo explícito antes de promover, com `DIRECT_URL` do ambiente
alvo — manual no começo, depois um job de CI disparado na promoção.

```bash
DIRECT_URL="<session pooler do ambiente>" npx prisma migrate deploy
```

## Promoção

1. PR → preview automático → revisão.
2. Merge em `main` → staging.
3. Verificar `/api/ready` em staging: `ready`, `migrations: N applied`,
   `storage: s3`.
4. Aplicar migrations em produção, se houver novas.
5. Promover o deploy de staging para produção (a Vercel promove o mesmo
   artefato — nada é reconstruído, então o que foi testado é o que vai ao ar).
6. Verificar `/api/ready` em produção.

Rollback: promover o deploy anterior. **Atenção:** rollback de código não
desfaz migration. Como todas são aditivas até aqui, um deploy anterior
convive com um schema mais novo — mantenha essa propriedade.

## Região das funções

`vercel.json` fixa `regions: ["pdx1"]` (Portland).

Não é preferência: é a consequência direta de o banco estar em `us-west-2`. Um
deploy em `gru1` (São Paulo) — que foi o padrão que a Vercel escolheu sozinha —
coloca cada consulta atravessando o continente, ~200 ms, e uma tela faz cinco.
Com aplicação e banco na mesma costa, a consulta volta a ~1 ms e o usuário paga
uma única viagem.

Fica no repositório em vez de no painel porque assim acompanha o código: quem
clonar e implantar não precisa saber desta conversa para acertar.

## Probes

| Endpoint | Pergunta | Uso |
|---|---|---|
| `/api/health` | o processo está vivo? | liveness |
| `/api/ready` | pode receber tráfego? | readiness, verificação pós-deploy |

`/api/ready` checa: contrato de ambiente, demonstração desligada, banco
acessível, migrations aplicadas, storage persistente. Responde 200/503 e
**nomes** de variáveis, nunca valores.

## Ainda não

Sem domínio, sem DNS, sem usuário real. Esta fase prepara; abrir para uso é
decisão sua, depois de staging existir e o restore ter sido testado.
