# Segredos e configuração

## Auditoria

| Variável | Sensível | Onde é lida | Situação |
|---|---|---|---|
| `AUTH_SECRET` | **sim** | assina a sessão | fallback publicado em dev; recusado em ambiente real |
| `DATABASE_URL` | **sim** (contém senha) | runtime da aplicação | ausente hoje fora de dev |
| `DIRECT_URL` | **sim** | só migrations | opcional, necessário com pooler |
| `SHADOW_DATABASE_URL` | **sim** | só `db:proof` | criada e destruída pelo script |
| `STORAGE_ACCESS_KEY` | **sim** | driver s3 | ausente |
| `STORAGE_SECRET_KEY` | **sim** | driver s3 | ausente |
| `STORAGE_BUCKET` | não | driver s3 | ausente |
| `STORAGE_ENDPOINT` / `REGION` / `FORCE_PATH_STYLE` | não | driver s3 | padrão local |
| `APP_ENV` | não | decide o contrato | ver `01_ENVIRONMENT_MODEL.md` |
| `APP_URL` | não | links absolutos | derivado na Vercel |
| `UPLOAD_MAX_SIZE_MB` | não | limite de upload | padrão 25 |
| `EMAIL_SERVER` / `EMAIL_FROM` | sim / não | **nada ainda** | declaradas sem consumidor |

## Varredura de segredo em código

Nenhuma credencial embutida. O único valor constante é
`DEMO_SIGNING_KEY` — deliberadamente **publicado**, deliberadamente óbvio, e
recusado em qualquer ambiente real tanto pelo schema quanto pelo boot.

`.env` não é versionado (`.gitignore`); `.env.example` é versionado e não
contém segredo.

## Regras

1. Segredo diferente por ambiente. Produção nunca compartilha com demo;
   staging nunca compartilha `AUTH_SECRET` com produção.
2. Preview não herda segredo de produção. A Vercel permite escopo por
   ambiente — use, e gere um `AUTH_SECRET` próprio para preview.
3. `AUTH_SECRET` com entropia real: `openssl rand -base64 32` (32 bytes → 44
   caracteres). O schema exige ≥ 32 caracteres e rejeita uma lista de
   placeholders.
4. **Nenhum segredo de produção é gerado por mim nem escrito neste
   repositório.** Os valores são criados por você, no painel.
5. Rotacionar `AUTH_SECRET` invalida todas as sessões de uma vez — é aceitável,
   mas precisa ser uma decisão, não uma surpresa.

## Mínimo por ambiente

**development** — nada. Roda sem configuração.

**test / CI** — `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (descartável),
`APP_ENV=test`.

**demo** — `APP_ENV=demo`. Banco e storage próprios, jamais os de produção.

**preview** — `APP_ENV` derivado, `DATABASE_URL` (banco de preview/staging,
nunca produção), `AUTH_SECRET` próprio.

**staging** — `APP_ENV=staging`, `DATABASE_URL` (pooler), `DIRECT_URL`,
`AUTH_SECRET`, `STORAGE_DRIVER=s3` + endpoint, região, chave, segredo, bucket.

**production** — o mesmo de staging, com `APP_ENV=production` e **valores
distintos em todos os campos sensíveis**.
