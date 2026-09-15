# Primeiro administrador real

## O problema

Não existe autocadastro: contas são criadas por um administrador. Um banco
recém-migrado não tem administrador nenhum, então a primeira conta precisa vir
de fora do produto — sem gambiarra, sem senha fixa, sem endpoint temporário.

## Três seeds, propósitos distintos

| Seed | Comando | Onde pode rodar |
|---|---|---|
| **Demonstração** | `npm run seed` | development, test, demo |
| **Test** | fixtures dos testes (`tests/factories.ts`) | banco de teste |
| **Production bootstrap** | `npm run create-admin` | qualquer banco, inclusive produção |

O seed de demonstração **trunca as tabelas** antes de recriar os dados. Ele já
se protege: contra banco remoto exige confirmação explícita, e a senha
conveniente (`vionex123`) só é usada onde a demonstração é permitida — em
qualquer outro caso gera uma aleatória e a imprime uma vez.

**Produção jamais recebe:** `vionex123`, usuários demo, fornecedores demo,
projetos demo, snapshot demo, credencial publicada.

## O mecanismo

`npm run create-admin` (`scripts/create-admin.ts`) já existe e é adequado:

- **aditivo** — nunca apaga nada, reaproveita a organização se já houver;
- **recusa sobrescrever** uma conta existente — criar nunca vira troca de
  senha silenciosa;
- lê `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` quando definidos (para
  automação), senão **pergunta**;
- a pergunta de senha é **mascarada**, para o segredo não cair no histórico do
  shell nem na rolagem do terminal;
- hash bcrypt custo 12, igual ao resto do produto.

Existe também `npm run user:create -- "Nome" email ROLE`, que cria uma conta
interna adicional e imprime uma senha aleatória uma única vez.

## Procedimento recomendado para produção

1. Migrations aplicadas, `/api/ready` verde.
2. `DATABASE_URL` apontando para o banco de produção, na sua máquina:
   ```bash
   DATABASE_URL="<pooler de produção>" npm run create-admin
   ```
3. Informe nome, e-mail corporativo e uma senha forte gerada por gerenciador
   de senhas — **não** uma senha memorizável.
4. Entre, e troque a senha em Configurações → Alterar senha.
5. Crie as demais contas pela própria interface (Equipe), que é o caminho
   normal do produto.

## Decisão que é sua

Se preferir que a primeira senha seja **gerada pelo sistema** e trocada no
primeiro acesso, isso exige um campo "precisa trocar senha" — ou seja,
**mudança de schema e de comportamento do produto**, depois do freeze. Não foi
implementado. O fluxo acima chega ao mesmo lugar sem tocar no produto: gere a
senha no seu gerenciador e troque depois de entrar.
