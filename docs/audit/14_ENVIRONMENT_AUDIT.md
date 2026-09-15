# 14 — Ambientes

## Mapa real

| Ambiente | Existe? | Banco | Storage | Auth | Domínio | Deploy |
|---|---|---|---|---|---|---|
| **local** | sim | Postgres via `scripts/local-db.mjs`, porta 5433 | filesystem `./storage` | `.env` local | `localhost:3000` | `next dev` |
| **test** | sim | **o mesmo banco local** | `os.tmpdir()` (`tests/setup.ts`) | `.env` local | — | `vitest run` |
| **CI** | escrito, **não instalado** | `postgres:16-alpine` efêmero | `./.ci-storage` | secret de CI | — | — |
| **preview** | **não existe** | — | — | — | — | — |
| **staging** | **não existe** | — | — | — | — | — |
| **production** | sim | **embutido em memória** (sem `DATABASE_URL`) | `local` (efêmero) | chave publicada | Vercel | push em `main` |

## ENV-001 — Ambiente de teste compartilha o banco de desenvolvimento · **MEDIUM**

`tests/setup.ts` usa a mesma `DATABASE_URL` do `.env`. As factories criam e
destroem organizações inteiras (`destroyOrg` em `tests/factories.ts` faz
`deleteMany` em cascata ordenada).

Não é "teste usando banco de produção" — o cenário crítico que a auditoria pediu
para procurar **não acontece**, porque não há banco de produção. Mas é a mesma
classe de problema em escala menor: rodar a suíte apaga dados de desenvolvimento.

## ENV-002 — Não existem preview nem staging · **HIGH**

`git branch -a` retorna apenas `main`. Não há `vercel.json` versionado, então
toda a configuração de deploy vive no painel da Vercel, fora do controle de
versão e fora de revisão.

Consequência: **não há nenhum lugar onde uma mudança seja exercida antes de
chegar ao endereço que as pessoas usam.** Combinado com GOV-001 (o CI não roda),
um push com erro de tipo chega a produção.

## ENV-003 — Produção não tem persistência real · **CRITICAL**

Ver DB-007. Sem `DATABASE_URL`, `src/server/demo/embedded-db.ts` levanta um
Postgres em WebAssembly carregado de um snapshot embutido no bundle.

O modo de falha mais provável não é esquecer de configurar — é **apagar a
variável sem querer no painel**, ou deixá-la em branco. `blankToUndefined` em
`src/lib/env-schema.ts` trata `""` como ausente (decisão correta para outras
variáveis) e `shouldUseEmbeddedDatabase` faz `.trim() === ""`. As duas juntas
fazem uma variável em branco cair silenciosamente no banco em memória, **em
produção, com o health check respondendo 200**.

Uma aplicação que perdeu o banco deve recusar-se a servir, não trocar de banco.

## Variáveis por ambiente

Chaves declaradas em `src/lib/env-schema.ts` (valores nunca reproduzidos aqui):

| Variável | Obrigatória? | Default | Problema |
|---|---|---|---|
| `DATABASE_URL` | **não** | — | ausente → banco em memória (ENV-003) |
| `DIRECT_URL` | não | — | só migrations |
| `AUTH_SECRET` | **não** | `DEMO_SIGNING_KEY` **publicada** | SEC-003 |
| `APP_URL` | não | `VERCEL_URL` ou localhost | **nenhum código a lê** |
| `STORAGE_DRIVER` | não | `local` | `local` em produção perde arquivos (STO-003) |
| `STORAGE_*` | condicional | — | exigidas só quando driver é `s3` |
| `UPLOAD_MAX_SIZE_MB` | não | 25 | ok |
| `EMAIL_SERVER` / `EMAIL_FROM` | não | — | **nenhum código as lê** |

Duas variáveis declaradas e nunca lidas (`APP_URL`, `EMAIL_SERVER`): não são
defeito, mas documentam intenção que ainda não existe.

## Recomendação

```
local ──→ preview (por PR, banco efêmero) ──→ staging (espelho, banco próprio)
                                                   │
                                            aprovação manual
                                                   │
                                              production
```

Com secrets **separados por ambiente** e nenhum compartilhamento de banco,
storage ou chave de assinatura entre eles.
