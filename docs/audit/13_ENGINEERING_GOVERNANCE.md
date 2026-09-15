# 13 — Governança de engenharia

## GOV-001 — O CI existe e não roda · **HIGH** · bloqueia produção

`ci/github-ci.yml` é um pipeline correto e bem pensado: sobe um Postgres 16 real
como service, aplica migrations com `prisma migrate deploy`, roda lint, typecheck,
testes e build. O `ci/README.md` explica a decisão de usar banco real:

> *"the supplier isolation guarantees are expressed as database queries — mocking
> them would test the mock instead of the rules."*

**Mas não existe `.github/workflows/`.** Verificado: `ls .github` falha.

O arquivo está no lugar errado. Nenhum push é verificado. Todo commit em `main`
vai direto para a Vercel sem lint, sem tipos, sem testes e sem build validado.

Isso também explica por que TEST-001 passou despercebido: o único lugar onde a
suíte roda por inteiro é justamente o que não está ligado.

## GOV-002 — Deploy não aplica migrations · **HIGH** · bloqueia produção

`package.json`: `"build": "npm run demo:snapshot && next build"`. Não há
`vercel.json`, nem `vercel-build`, nem `postbuild`. O `README.md` instrui
`npm run db:deploy` manualmente.

Código e schema podem divergir em produção sem que nada detecte.

## GOV-003 — Branch única, sem PR, sem revisão · **MEDIUM**

```
* main
  remotes/origin/main
```

Sem branch de desenvolvimento, sem branch de release, sem PR, sem revisão, sem
preview. O histórico é uma sequência linear de commits em `main`.

Para um projeto de uma pessoa isso é normal. Para uma plataforma que vai
guardar dossiês regulatórios e contratos de fornecedores internacionais, não é.

## GOV-004 — Configuração de deploy fora do controle de versão · **MEDIUM**

Sem `vercel.json` nem `vercel.ts`. Região, variáveis, domínio, proteção de
deploy e regras de build vivem apenas no painel. Não são revisáveis, não são
auditáveis, não são reproduzíveis.

## O que está bem feito

| Ponto | Evidência |
|---|---|
| `.env` fora do git, `.env.example` versionado | `.gitignore`; `git ls-files` não retorna `.env` |
| Nenhum segredo real versionado | `git grep` por padrões de credencial: só placeholders |
| Mensagens de commit descritivas, explicando o **porquê** | `git log` |
| `AGENTS.md` com regra de ler a documentação do Next antes de escrever código | raiz |
| Comentários que documentam trade-offs e decisões anteriores que deram errado | por todo o `src/server/` |
| Zero `TODO`/`FIXME`/`HACK` em todo o repositório | verificado |

Esse último ponto merece registro: a disciplina de comentários deste repositório
é excepcional. Os comentários explicam decisões, não repetem o código.

## Fluxo recomendado

```
feature branch
   ↓
Pull Request
   ↓
CI: lint · typecheck · test (com Postgres real) · build
   ↓
revisão de um humano
   ↓
deploy de preview automático
   ↓
merge em main
   ↓
staging (migrations aplicadas automaticamente)
   ↓
aprovação manual
   ↓
production (migrations aplicadas, com rollback documentado)
```

### Regras propostas

1. `main` protegida: sem push direto, CI verde obrigatório, uma aprovação.
2. **Migrations são forward-only.** Nenhuma migration aplicada é editada, movida,
   renomeada ou reaplicada. Correção é sempre uma migration nova.
3. Toda migration com efeito destrutivo exige aprovação explícita e backup
   verificado na mesma janela.
4. Secrets nunca em código, nunca em PR, nunca em log. Rotação documentada.
5. `vercel.json` versionado, para que a configuração de deploy seja revisável.
6. Acesso ao banco de produção nominal e auditado — hoje a aplicação conecta como
   dona do schema, sem role restrita.
