# Integração contínua

O workflow do GitHub Actions está em **`ci/github-ci.yml`**, fora de `.github/workflows/`.

Motivo: o GitHub recusa qualquer push que crie ou altere arquivos em `.github/workflows/`
quando o token usado não tem o escopo `workflow`. Em vez de deixar o CI fora do
repositório, ele fica versionado aqui e é ativado com um `git mv`.

## Ativar

Com um token que tenha o escopo `workflow`:

```bash
mkdir -p .github/workflows
git mv ci/github-ci.yml .github/workflows/ci.yml
git commit -m "Ativar CI"
git push
```

Sem mexer no token: abra `ci/github-ci.yml` no GitHub, copie o conteúdo e crie
`.github/workflows/ci.yml` pela interface web (aba **Actions** → *set up a workflow
yourself*). A interface web não depende do escopo do token.

## O que ele faz

Sobe um PostgreSQL 16 de serviço, aplica as migrations e roda lint, typecheck, os 85 testes
e o build — a cada push na `main` e em cada pull request.

Os testes de integração usam um banco real de propósito: as garantias de isolamento entre
fornecedores são consultas SQL, e simulá-las testaria o mock em vez da regra.
