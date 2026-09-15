# 29 — Plano de resposta a incidentes

> Proposta. Nada foi executado.

## Pré-requisito

Hoje **não existe nenhum caminho pelo qual um erro em produção notifique alguém**
(OPS-001). Este plano só é executável depois da Fase J. Até lá, todo incidente é
descoberto por um usuário reclamando.

## Severidade

| Nível | Definição | Resposta |
|---|---|---|
| **SEV1** | vazamento de dados, comprometimento de conta, perda de dados, plataforma fora | imediata |
| **SEV2** | funcionalidade crítica quebrada (upload, download, login) | mesmo dia |
| **SEV3** | funcionalidade degradada, contornável | próximo ciclo |

## Cenários

### Banco indisponível

Sintoma: `/api/health` responde 503 `degraded`.
**Risco específico deste sistema:** se a causa for `DATABASE_URL` apagada, a
aplicação **não** fica fora — ela sobe sobre o banco em memória e responde
**200 ok** (DB-007). Toda escrita subsequente se perde.

1. Confirmar se `DATABASE_URL` está presente e correta — **antes** de olhar o provedor.
2. Se estiver ausente: **derrubar a aplicação imediatamente**. Continuar servindo é pior que ficar fora.
3. Se estiver presente: verificar o provedor, conexões e limites.
4. Após restabelecer, conferir a última entrada de `AuditLog` para estimar o que se perdeu.

### Storage indisponível

Sintoma: uploads e downloads falham; o resto funciona.
`/api/health` **não detecta isso hoje** — responde `ok`.

1. Verificar credenciais e endpoint.
2. Comunicar os fornecedores: o portal funciona, o envio de arquivos não.
3. Não instruir reenvio até restabelecer — duplicaria versões.

### Deploy ruim

1. Promover o deploy anterior (não redeployar) — ver [28](28_ROLLBACK_PLAN.md).
2. Confirmar que o código promovido é compatível com o schema em banco.

### Migration falhou no meio

1. **Não reexecutar.** Não editar a migration.
2. Verificar `_prisma_migrations` para saber onde parou.
3. Restaurar do backup **numa instância nova** se o estado for inconsistente.
4. Corrigir com uma migration **nova**, para a frente.

### Vazamento de secret

`AUTH_SECRET`:
1. Rotacionar. **Todas as sessões caem** — é o efeito desejado.
2. Comunicar que todos precisarão entrar de novo.
3. Revisar `AuditLog` no período, procurando ações inesperadas.

`DATABASE_URL` ou credenciais de storage: rotacionar no provedor, atualizar o
ambiente, redeployar. Verificar logs de acesso do provedor.

### Conta de administrador comprometida

1. `status = SUSPENDED` — tem efeito na próxima requisição, porque
   `getCurrentUser` relê do banco. **Este é o único desligamento efetivo hoje**:
   não há revogação de token (SEC-007).
2. Rotacionar `AUTH_SECRET` para derrubar todas as sessões.
3. Levantar em `AuditLog` tudo que a conta fez.
4. **Limitação conhecida:** `document.download` é auditado, mas não há tela para
   consultar. A investigação exigiria acesso direto ao banco.

### Documento apagado por engano

**Não pode acontecer pela aplicação** — não existe exclusão em nenhum caminho.
Se acontecer, foi por acesso direto ao banco ou ao bucket, e o caminho é o
restore.

### Suspeita de vazamento entre fornecedores

**O mais grave de todos.**
1. Preservar evidência: não corrigir antes de registrar.
2. Identificar a consulta pelo `AuditLog` e pelos logs de aplicação.
3. Avaliar o alcance: quais linhas, quais fornecedores, por quanto tempo.
4. Corrigir e adicionar um teste que teria pego.
5. Notificação aos afetados: **LEGAL REVIEW REQUIRED**.

## O que falta para este plano funcionar

| Necessário | Existe? |
|---|---|
| Alerta chegando a um humano | **não** |
| Log com `requestId` e `userId` | **não** |
| Tela de consulta do audit log | **não** |
| Backup restaurável | **não** |
| Rollback exercitado | **não** |
| Responsável de plantão definido | **não verificável no repositório** |
