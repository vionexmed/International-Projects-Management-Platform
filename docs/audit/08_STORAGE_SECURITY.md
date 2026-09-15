# 08 — Segurança de documentos e storage

## Desenho

`src/lib/storage/` expõe um driver com três operações (`put`, `get`, `delete`) e
duas implementações: `local.ts` (filesystem, desenvolvimento) e `s3.ts`
(S3-compatível). A escolha é feita em `index.ts` por `STORAGE_DRIVER`.

**Não existe URL assinada. Não existe bucket público. Todo arquivo passa pela
aplicação**, por `GET /api/files/[versionId]`, com a sessão revalidada e o escopo
reaplicado.

## A pergunta crítica

> Se o Fornecedor A descobrir a URL do arquivo do Fornecedor B, ele consegue baixar?

**Não.** Três razões independentes:

1. A URL não contém a chave do objeto — contém o `id` da `DocumentVersion`.
   A chave de storage nunca sai do servidor.
2. `requireDocumentVersionAccess` (`src/server/authz/access.ts`) refaz o escopo:
   ```ts
   db.documentVersion.findFirst({
     where: { id: versionId, document: documentScope(user) },
   })
   ```
   Para um fornecedor, `documentScope` exige `project.supplierId = <o dele>` **e**
   `visibility: SHARED_WITH_SUPPLIER`. Id de outro fornecedor → 404.
3. Mesmo a chave real é imprevisível: `buildStorageKey` em
   `src/lib/storage/index.ts` produz `organizationId/projectId/<uuid>-nome`.

E um link copiado para fora da plataforma é inútil sem cookie de sessão válido.

**Status:** CONFIRMED.

## Checklist de ataque

| Vetor | Situação | Evidência |
|---|---|---|
| Path traversal | **protegido** | `resolveKey` em `src/lib/storage/local.ts` recusa qualquer chave que escape da raiz |
| Chave adivinhável | **protegido** | `randomUUID()` em `buildStorageKey` |
| MIME spoofing | **parcialmente** | extensão × MIME conferidos, mas ambos vêm do cliente — SEC-006 |
| Extensão divergente | **protegido** | `validateUpload` em `src/lib/upload.ts` |
| XSS armazenado | **protegido** | SVG e HTML fora da allowlist + `X-Content-Type-Options: nosniff` na rota de download |
| Upload malicioso (malware/macro) | **desprotegido** | sem antivírus, sem sandbox — SEC-006 |
| Limite de tamanho | **protegido** | `UPLOAD_MAX_SIZE_MB`, padrão 25, revalidado no servidor |
| Download sem autenticação | **protegido** | 401 antes de qualquer consulta |
| Documento entre fornecedores | **protegido** | escopo reaplicado |
| Expiração de URL assinada | **não se aplica** | não há URLs assinadas |
| Nome de arquivo internacional | **protegido** | `filename*=UTF-8''${encodeURIComponent(...)}` (RFC 5987) — nome em chinês é preservado |
| Cache compartilhado | **protegido** | `Cache-Control: private, no-store` |
| Auditoria do download | **registrado** | `recordAudit({ action: "document.download", ... })` |

O tratamento do `Content-Disposition` merece destaque: `filename*=UTF-8''` com
`encodeURIComponent` é exatamente o que faz um arquivo chamado `产品说明书.pdf`
chegar com o nome certo. Poucos projetos acertam isso.

## STO-001 — Arquivos órfãos quando a transação falha · **MEDIUM**

**Evidência:** `src/server/services/documents.ts`, função `uploadDocument`:

```ts
const buffer = Buffer.from(await input.file.arrayBuffer());
await storage().put(storageKey, buffer, input.file.type);   // ← storage primeiro

const document = await db.$transaction(async (tx) => { ... });  // ← banco depois
```

A escrita no storage acontece **antes** e **fora** da transação. Se a transação
falhar — violação de constraint, timeout, queda de conexão — o arquivo
permanece no bucket sem nenhuma linha que o referencie.

Consequências:
- Blobs acumulam indefinidamente, sem forma de encontrá-los ou apagá-los.
- Custo de storage cresce sem explicação.
- **Governança de dados:** um documento que o usuário acredita não ter sido
  enviado continua existindo. Para uma solicitação de exclusão sob LGPD/GDPR, não
  há como localizá-lo.

Não há compensação (`try/catch` com `storage().delete`) nem rotina de varredura.

**Status:** CONFIRMED.

## STO-002 — Arquivo inteiro carregado em memória · **MEDIUM**

**Evidência:**
- Download: `src/app/api/files/[versionId]/route.ts` —
  `new NextResponse(new Uint8Array(object.body), ...)`
- Driver S3: `src/lib/storage/s3.ts` — `result.Body?.transformToByteArray()`
- Upload: `src/server/services/documents.ts` —
  `Buffer.from(await input.file.arrayBuffer())`

Nenhum caminho usa streaming. Com o limite de 25 MB, cada download concorrente
ocupa ~25 MB na função serverless (mais a cópia em `Uint8Array`, que pode dobrar
esse valor durante a conversão). Downloads simultâneos levam a função ao limite
de memória.

Com S3 o `GetObject` já devolve um stream; ele é colapsado em bytes
desnecessariamente.

**Status:** CONFIRMED.

## STO-003 — `STORAGE_DRIVER=local` em produção perde documentos · **HIGH** se acontecer

**Evidência:** `src/lib/storage/index.ts` cai no driver local para qualquer valor
que não seja `s3`. `src/lib/env-schema.ts` dá `STORAGE_DRIVER` o default
`"local"` e **não bloqueia** o boot em produção.

O filesystem de uma função serverless é efêmero: o upload retorna sucesso, o
documento aparece na interface, e desaparece quando a instância recicla. O
usuário não recebe nenhum aviso — só um download quebrado semanas depois.

`src/app/api/health/route.ts` reporta isso como warning, e o comentário no código
explica que a checagem foi afrouxada de propósito para não derrubar a aplicação
inteira por causa de uma funcionalidade:

> *"This used to refuse to boot, which turned out to be the wrong trade: it
> blocked every page that has nothing to do with documents."*

A decisão de não derrubar o boot é defensável. O problema é que **hoje não há
nenhum aviso na interface** — nem para quem envia o documento, nem para o
administrador. O `/api/health` só é visto por quem procura.

A documentação está desatualizada: `.env.example` ainda afirma que
*"`local` is REFUSED in production"*.

**Status:** CONFIRMED.

## STO-004 — Sem criptografia declarada em repouso · **LOW**

`src/lib/storage/s3.ts`, `PutObjectCommand` não define `ServerSideEncryption`.
Depende inteiramente da configuração default do bucket, que não está sob controle
de versão. Para documentos regulatórios e contratos, a criptografia em repouso
deveria ser explícita no código e verificável.

## STO-005 — Sem retenção, sem exclusão, sem versionamento no bucket · **MEDIUM**

- `storage().delete()` existe no driver mas **nenhum código de aplicação o chama**
  (`grep -rn "storage().delete"` → só a definição). Nada é apagado pela aplicação.
- Não há política de retenção nem de ciclo de vida.
- Não há verificação de integridade (checksum) além de `fileSize`.
- `DocumentVersion` guarda todas as versões para sempre.

Para LGPD/GDPR isso significa que **não existe caminho técnico para atender a um
pedido de exclusão**. Ver [12_DATA_GOVERNANCE.md](12_DATA_GOVERNANCE.md).

## Entrega global

Com todo download passando pela função, um fornecedor em Xangai baixando 25 MB
puxa o arquivo de uma região dos EUA ou da Europa, em memória, sem CDN, sem
suporte a `Range`, sem retomada. Numa rede instável, um download interrompido
recomeça do zero. Ver [30_GLOBAL_READINESS.md](30_GLOBAL_READINESS.md), GLB-005.

A dependência `@aws-sdk/s3-request-presigner` já está instalada e **não é usada** —
ela é exatamente a peça necessária para URLs assinadas de curta duração, que
resolveriam STO-002 e GLB-005 de uma vez. Vale notar que isso troca uma
propriedade de segurança (chave nunca sai do servidor) por desempenho; a decisão
precisa ser consciente.
