# Decisão de storage

## Recomendação

**Supabase Storage, usado pelo endpoint S3-compatível, com o driver `s3` que
já existe.** Sem mudança de código.

## Por quê

A abstração atual é pequena de propósito — três métodos, chave opaca resolvida
só no servidor:

```ts
interface StorageDriver {
  put(key, body, contentType): Promise<void>;
  get(key): Promise<StoredObject>;
  delete(key): Promise<void>;
}
```

Não há URL assinada, não há URL pública, não há SDK de provedor acima dessa
linha. **Todo download passa por `/api/files/[versionId]`**, que revalida a
sessão, reaplica o escopo do fornecedor e registra auditoria.

O Supabase expõe um endpoint S3-compatível
(`https://<ref>.storage.supabase.co/storage/v1/s3`) com chave e segredo
próprios. O driver `s3` atual fala com ele através do `@aws-sdk/client-s3`
configurando `STORAGE_ENDPOINT` e `STORAGE_FORCE_PATH_STYLE=true`. **Zero
linha de código muda.**

## Comparação

| Critério | Supabase Storage | S3 / R2 separado |
|---|---|---|
| Compatível com a abstração atual | **sim, sem código** | sim, sem código |
| Bucket privado | sim | sim |
| Autorização no servidor | nossa rota, inalterada | nossa rota, inalterada |
| URL assinada | existe, **não usaremos** | existe, **não usaremos** |
| Um fornecedor, uma fatura | **sim** | não |
| Entrega internacional | igual (AWS por trás) | R2 teria leve vantagem |
| Acesso a partir da China | igual — nem um nem outro é garantido | igual |
| Backup | acompanha o projeto Supabase | precisa de política própria |
| Lock-in | baixo: é S3-compatível, migrável copiando objetos | baixo |

O que decide é a última coluna da primeira linha: nenhum dos dois exige código
novo, então o critério passa a ser complexidade operacional — e um fornecedor
a menos para provisionar, faturar e auditar vale mais do que a diferença
marginal de entrega.

## Limites que continuam valendo

- Bucket **privado**. Sem exceção: o controle de acesso é a rota autenticada,
  e um bucket público faz o isolamento entre fornecedores deixar de existir —
  o banco continuaria correto, os arquivos não.
- **Sem URL assinada de longa duração** e sem bypass por id de anexo. Isso já
  foi decidido em PC-5 e não muda por trocar de provedor.
- Validação de upload continua sendo MIME × extensão × tamanho, na aplicação.
- `UPLOAD_MAX_SIZE_MB` (25) deve caber no limite de request da plataforma de
  deploy.

## O custo que aceitamos

O download faz dois saltos: storage → aplicação → usuário, porque o arquivo é
transmitido pela rota autenticada em vez de por link direto. É mais lento e
consome mais banda do que uma URL assinada. É o preço da invariante, e a
invariante é o produto.

## Aplicado em 17/09/2026

| Item | Estado |
|---|---|
| Bucket `documents` | ✅ **privado**, limite 25 MB (igual ao do produto) |
| S3 protocol connection | ✅ ligado |
| Endpoint | `https://nxearovwvfotbernsrji.storage.supabase.co/storage/v1/s3` |
| Região | `us-west-2` |
| Chaves de acesso | ✅ criadas no painel (`vionex-projects-app`) |
| Código alterado | **nenhuma linha** |

Verificado com o driver do próprio produto:

```
upload pelo driver ........................ ✓
download, bytes idênticos ................. ✓ (content-type preservado)
acesso direto público → HTTP 400 .......... ✓ recusado
acesso direto sem token → HTTP 400 ........ ✓ recusado
delete .................................... ✓
```

As duas linhas do meio são as que importam: o objeto **não** é alcançável por
fora da rota autenticada. O bucket privado e `/api/files/[versionId]` continuam
sendo a única porta.

`/api/ready` responde `storage: s3`.

## Não migrado nesta fase

A troca só acontece quando o bucket existir. Quando acontecer:

1. Criar o bucket privado.
2. Definir `STORAGE_DRIVER=s3` e as credenciais.
3. Copiar os arquivos de `./storage` **preservando a `storageKey`** de cada
   `DocumentVersion` — a chave é a ligação entre a linha e o objeto.
4. Verificar, e só então desligar o driver local.
5. Testar: upload → download autenticado → tentativa pelo fornecedor errado
   (tem de falhar) → tentativa de acesso direto ao objeto (tem de falhar).

Não houve arquivo real a copiar: o storage local só continha uploads da
demonstração, e o banco Supabase nasceu vazio.
