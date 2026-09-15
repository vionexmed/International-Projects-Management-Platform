# Modelo de ambientes

## Os seis ambientes

`development` · `test` · `demo` · `preview` · `staging` · `production`

Declarados em `src/lib/app-env.ts`, validados por 17 testes em
`tests/unit/environment-contract.test.ts`.

## Precedência

```
APP_ENV explícito  →  VERCEL_ENV  →  NODE_ENV  →  development
```

1. **`APP_ENV`** vence sempre. Valor fora da lista é **erro**, não fallback —
   `APP_ENV=prod` falha em vez de virar `production` por engano.
2. **`VERCEL_ENV`** identifica `production` e `preview` quando `APP_ENV` não
   foi definido. É posto pela plataforma, não por uma pessoa que pode esquecer.
3. **`NODE_ENV`** só distingue `test`; `production` sem outro sinal resolve
   para `production` — assume-se o lado estrito.
4. Sem nada: `development`.

**Nenhum caminho produz `demo`.** Demonstração é declarada, nunca inferida:
uma variável faltando é falha, não convite para abrir o seletor de contas sem
senha.

`NODE_ENV` responde uma pergunta de build ("este bundle é otimizado?").
`APP_ENV` responde a operacional ("que implantação é esta?"). Na Vercel todo
preview é `NODE_ENV=production`, então uma regra escrita contra `NODE_ENV`
trata um preview descartável e o sistema real como o mesmo lugar.

## Contrato por ambiente

| | development | test | demo | preview | staging | production |
|---|---|---|---|---|---|---|
| **Database** | local ou embutido | descartável | explícito de demo | **real obrigatório** | **real persistente** | **real persistente** |
| **Storage** | local | local | local ou S3 | S3 recomendado | **S3 obrigatório** | **S3 obrigatório** |
| **Auth secret** | fallback publicado | fallback | fallback | **próprio** | **próprio** | **próprio** |
| **Demo sign-in** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Secrets** | `.env` local | env de CI | do ambiente demo | próprios | próprios | próprios |
| **Migrations** | `migrate dev` | `migrate deploy` | `migrate deploy` | `migrate deploy` | `migrate deploy` | `migrate deploy` |
| **Observability** | console | console | console | logs da plataforma | logs + readiness | logs + readiness + alerta |

## Como o contrato é aplicado

`src/instrumentation.ts` roda `register()` **uma vez, antes do servidor aceitar
o primeiro request**, e recusa subir quando o ambiente é real e:

- `DATABASE_URL` está ausente;
- `AUTH_SECRET` é a chave publicada de demonstração, ou um placeholder;
- o login sem senha estaria habilitado;
- `STORAGE_DRIVER=local` em `staging`/`production` (em `preview` é só aviso).

Recusar é a decisão certa: uma implantação errada que sobe é pior que uma que
não sobe, porque alguém começa a usá-la e a parte quebrada é descoberta por
quem precisar dela primeiro.

Não há consulta ao banco nessa checagem. A pergunta é "esta implantação pode
servir?", e ela não pode depender de algo que também pode estar fora do ar —
banco inacessível é sistema degradado, não proibido, e as duas coisas merecem
respostas diferentes.

Todos os problemas são reportados de uma vez, não um por deploy.

## Isolamento da demonstração

O ambiente `demo` permanece separado e **não compartilha** banco, storage,
`AUTH_SECRET`, sessões, usuários ou dado real com nenhum ambiente real. Para
ter uma demonstração no ar, a implantação declara `APP_ENV=demo` — esse é o
mecanismo inteiro.

Em `preview`, `staging` e `production`: `/demo` e `/demo/enter` respondem 404,
`/` vai para o formulário de login, o banco embutido é recusado com erro, e a
chave publicada é rejeitada.
