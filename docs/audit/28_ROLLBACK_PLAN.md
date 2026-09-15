# 28 — Plano de rollback

> Proposta. Nada foi executado.

## Regra que vale para tudo

**Código volta. Dados não.** Um rollback de código é barato e reversível; um
rollback de banco costuma ser perda de dados. Por isso as migrations devem ser
sempre compatíveis com a versão anterior do código durante a janela de
implantação — expand/contract, nunca uma mudança que quebre os dois lados ao
mesmo tempo.

## Rollback de código

Hoje: a Vercel permite promover um deploy anterior pelo painel.

Ponto de atenção registrado por experiência anterior neste projeto: **o botão de
Redeploy reutiliza o mesmo commit.** Para voltar de verdade é preciso promover o
deploy anterior, não redeployar o atual.

Procedimento:
1. Identificar o último deploy bom (data, commit, quem promoveu).
2. Promover esse deploy.
3. Verificar `/api/health`.
4. Verificar um caminho crítico de fim a fim: login → projeto → abrir documento.
5. Registrar o que aconteceu.

**Pré-condição que hoje não existe:** o código promovido precisa ser compatível
com o schema que está no banco. Sem migrations no pipeline (GOV-002), essa
garantia não existe.

## Rollback de migration

**Nenhuma migration histórica é editada, movida, renomeada ou reaplicada.**
Reverter é sempre uma migration **nova**, para a frente.

| Tipo de mudança | Como reverter |
|---|---|
| Coluna adicionada, nullable | migration nova que a remove. Seguro |
| Coluna adicionada, NOT NULL com default | idem |
| Coluna removida | **irreversível sem backup.** Por isso nunca remover na mesma janela em que se para de usar |
| Tipo alterado (ex.: `timestamp` → `date`) | **perda de precisão é irreversível.** Exige backup verificado na mesma janela |
| Índice | trivial nos dois sentidos |
| Constraint adicionada | migration nova que a remove |
| Migração de dados | **exige snapshot antes.** Sem exceção |

### Expand → migrate → contract

Para qualquer mudança de tipo ou remoção:

```
Deploy 1 (expand)   adiciona a coluna nova; o código escreve nas duas, lê da antiga
Deploy 2 (migrate)  backfill; o código lê da nova
Deploy 3 (contract) remove a antiga — só depois de a nova estar estável
```

Entre os deploys, **as duas versões do código funcionam**. É isso que torna o
rollback possível.

Isso vale especialmente para a conversão de datas da Fase I, que toca 52 colunas.

## Rollback de dados

Só pelo restore ([16_BACKUP_AND_RESTORE.md](16_BACKUP_AND_RESTORE.md)), e sempre
numa instância nova — **nunca sobre produção**.

Cuidado adicional: restaurar o banco sem restaurar o storage no mesmo ponto no
tempo produz uma plataforma que aponta para documentos inexistentes. Os dois
precisam voltar juntos.

## Rollback de secret

Rotacionar `AUTH_SECRET` **invalida todas as sessões ativas** — todos os usuários
são deslogados. É o comportamento correto num incidente, e precisa ser
comunicado antes numa manutenção planejada.

## Janelas

| Mudança | Janela | Aviso |
|---|---|---|
| Só código | qualquer hora | nenhum |
| Migration aditiva | horário de baixo uso | nenhum |
| Migration de tipo ou destrutiva | janela agendada, backup verificado na mesma janela | 48 h |
| Rotação de secret | janela agendada | 24 h — todos serão deslogados |

Considerar o fuso dos fornecedores ao escolher "baixo uso": 03:00 em São Paulo
é 14:00 em Xangai.
