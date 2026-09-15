# 16 — Backup e restore

## Estado atual: **não existe backup**

Não existe porque **não existe banco de produção**. O deploy atual roda sobre um
Postgres em memória (DB-007), que é reconstruído do snapshot embutido a cada
instância nova. Não há o que preservar — e essa é exatamente a gravidade.

| Item | Estado |
|---|---|
| Backup automático | **não** |
| Frequência | n/a |
| Retenção | n/a |
| Criptografia do backup | n/a |
| Point-in-time recovery | **não** |
| RPO (dado máximo que se pode perder) | **infinito** — toda escrita se perde no reciclo |
| RTO (tempo até voltar) | n/a |
| Procedimento de restore | **não documentado, nunca executado** |
| Backup do storage | **não** — `STORAGE_DRIVER=local` é efêmero |

## A pergunta obrigatória

> O backup foi apenas configurado ou existe confiança real de que pode ser restaurado?

**Nem uma coisa nem outra: não há backup.**

Registro esta regra para quando houver: **um backup que nunca foi restaurado não
é um backup — é uma suposição.** A verificação não é "o job rodou"; é "um humano
restaurou num ambiente separado, cronometrou e confirmou que os dados estão lá".

## Plano proposto

> Nada aqui foi executado. É proposta, para aprovação.

### 1. Provisionar Postgres gerenciado

Requisitos mínimos: backup automático diário, PITR de pelo menos 7 dias,
criptografia em repouso, e um endpoint direto além do pooled (as migrations
precisam de advisory locks de sessão, que um pooler em modo transação não tem —
`prisma.config.ts` já prevê isso com `DIRECT_URL`).

A escolha de provedor e **região** é uma decisão com consequências de residência
de dados — ver [34_DATA_RESIDENCY.md](34_DATA_RESIDENCY.md).

### 2. Metas a definir com o negócio

| Métrica | Pergunta | Sugestão inicial |
|---|---|---|
| **RPO** | quanto de trabalho a Vionex aceita perder? | 15 minutos (PITR) |
| **RTO** | quanto tempo a plataforma pode ficar fora? | 4 horas |
| **Retenção** | por quanto tempo guardar? | 30 dias PITR + 12 meses mensal |

Para documentos regulatórios, a retenção provavelmente é regida por norma. Marcar
como **LEGAL REVIEW REQUIRED**.

### 3. Backup do storage

Separado e igualmente obrigatório. Um backup do banco sem os arquivos restaura
uma plataforma que aponta para documentos inexistentes. Com S3: versionamento do
bucket + replicação entre regiões.

### 4. Procedimento de restore — a parte que importa

```
1. Provisionar instância nova, isolada. NUNCA restaurar sobre produção.
2. Restaurar o snapshot mais recente.
3. Restaurar o bucket no mesmo ponto no tempo.
4. Apontar um deploy de staging para a instância restaurada.
5. Verificar: contagem de projetos, documentos, usuários; abrir 3 documentos
   de fim a fim; conferir a última entrada de AuditLog.
6. Cronometrar. O RTO real é esse número, não o estimado.
7. Registrar data, executor, duração e problemas encontrados.
```

### 5. Cadência de verificação

Restore de teste **trimestral**, e obrigatoriamente após qualquer mudança de
provedor, versão maior do Postgres ou schema.

### 6. Antes de qualquer migration destrutiva

Backup sob demanda na mesma janela, verificado, com o comando de restore escrito
e testado **antes** de aplicar.

## Dependência

Nenhuma fase que toque migrations ([26_MASTER_IMPLEMENTATION_PLAN.md](26_MASTER_IMPLEMENTATION_PLAN.md),
Fase E) pode começar antes desta estar concluída **com um restore real
executado**.
