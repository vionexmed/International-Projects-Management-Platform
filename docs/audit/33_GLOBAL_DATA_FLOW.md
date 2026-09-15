# 33 — Fluxo global de dados

## Fluxo atual

```
Fornecedor (Xangai / Munique / Boston / Milão)
        │  HTTPS
        ▼
  Função serverless (região indefinida, hoje Vercel)
        ├──► Postgres  ── hoje: EM MEMÓRIA, dentro da própria função (DB-007)
        ├──► Storage   ── hoje: filesystem da função, efêmero (STO-003)
        └──► nada mais

Sem CDN. Sem e-mail. Sem webhook. Sem analytics. Sem integração externa.
```

## O que atravessa fronteiras hoje

| Dado | Origem | Destino | Observação |
|---|---|---|---|
| Credenciais de login | navegador do fornecedor | função | HTTPS + HSTS |
| Documentos enviados | navegador do fornecedor | função → storage | **inteiro em memória** (STO-002) |
| Documentos baixados | storage → função | navegador | idem, sem CDN e sem `Range` |
| Mensagens | navegador | banco | texto livre, sem criptografia de ponta a ponta |
| Endereço IP | navegador | `LoginAttempt.key` | dado pessoal |
| Nome de arquivo | navegador | `DocumentVersion.fileName` | preservado, inclusive em chinês |

## Travessias que **não** existem

Registrado porque reduz muito a superfície de análise de privacidade:

- Nenhum dado sai para terceiros — sem analytics, sem CDN, sem captcha, sem
  e-mail, sem webhook.
- O navegador não faz nenhuma requisição a domínio externo.
- Nenhum processador de dados adicional além do provedor de hospedagem.

## Caminho de um documento, de ponta a ponta

```
1. Fornecedor seleciona o arquivo          FileDropzone (cliente)
2. Validação no cliente                    tipo + tamanho
3. POST multipart                          Server Action
4. requirePermission("document:upload")
5. validateUpload                          MIME + extensão + tamanho (servidor)
6. Revalidação do projeto contra supplierId
7. buildStorageKey                         org/projeto/uuid-nome
8. storage().put()                         ← escrita externa
9. db.$transaction                         Document + Version + ponteiro
10. recordTimelineEvent                    fora da transação
11. recordAudit                            fora da transação
```

Riscos ao longo do caminho, já documentados: passo 5 confia no MIME declarado
(SEC-006); entre 8 e 9 nasce o órfão (REL-001); 10 e 11 podem falhar depois do
commit; e no caminho de submissão do fornecedor há uma segunda transação
independente (REL-002).

## Mapa a produzir depois da decisão de região

Quando [34_DATA_RESIDENCY.md](34_DATA_RESIDENCY.md) for decidido, este documento
deve ganhar a região efetiva de cada caixa e a lista nominal de sub-processadores
— hospedagem, banco gerenciado, storage, monitoramento — com a jurisdição de cada
um.
