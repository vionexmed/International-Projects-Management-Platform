# 25 — Arquitetura alvo

> Proposta. **Nada foi implementado.** O princípio é preservar o que está certo —
> ver [37_DO_NOT_TOUCH.md](37_DO_NOT_TOUCH.md) — e fechar o que falta.

## O que muda e o que não muda

**Não muda:** o núcleo de `src/server/authz/`, o desenho de sessão, os cabeçalhos
e a CSP, o storage sem bucket público, o padrão de agregação por `groupBy`, a
estrutura de rotas, a arquitetura de dois ambientes.

**Muda:** as guardas de ambiente, a segunda linha de defesa no banco, a camada de
saída por audiência, a abstração de fuso horário, a observabilidade e o pipeline.

## Diagrama alvo

```
Browser
  │
  ├─ proxy.ts ......................... CSP com nonce  [inalterado]
  │
  ├─ Layout do grupo de rotas
  │    └─ getCurrentUser() ............ cookie → banco  [inalterado]
  │
  ├─ Página RSC
  │    ├─ orNotFound(requireXAccess()) . [inalterado]
  │    └─ serviço
  │         └─ ► DTO por audiência ◄ ... NOVO — nunca entrega a linha crua
  │
  ├─ Server action
  │    ├─ requirePermission()  ......... [inalterado]
  │    ├─ Zod (mensagens i18n) ......... ALTERADO
  │    └─ serviço
  │
  └─ Camadas transversais
       ├─ ► fuso horário ◄ ............ NOVO — uma única fonte de verdade
       ├─ ► observabilidade ◄ ......... NOVO — log estruturado + alerta
       └─ ► i18n de servidor ◄ ........ NOVO — erros traduzíveis

Banco
  ├─ organizationId em TODAS as tabelas de tenant ... NOVO (pré-requisito de RLS)
  ├─ RLS como segunda linha ......................... NOVO (opcional, faseado)
  ├─ DATE para dias, timestamptz para instantes ..... ALTERADO
  └─ AuditLog protegido contra UPDATE/DELETE ........ NOVO
```

## As cinco mudanças estruturais

### 1. DTO por audiência

Hoje `getProjectWorkspace` devolve a linha crua para os dois ambientes, e é
assim que `ProjectStage.notes` chega ao fornecedor.

Alvo: o serviço nunca devolve a entidade crua para a camada de apresentação.
Duas projeções explícitas — interna e externa — e o compilador impede confundi-las.

Resolve: TEN-002, e a classe inteira.

### 2. `organizationId` em todas as tabelas de tenant

16 das 23 tabelas dependem de um join para o isolamento. Acrescentar a coluna é
pré-requisito de qualquer política de RLS futura — sem ela, cada policy precisaria
de subconsulta até `Project`.

Resolve: DB-006, e desbloqueia DB-008.

### 3. Abstração de fuso horário

Uma única fonte de verdade: `User.timezone` e `Supplier.timezone` (IANA), tipos
`DATE` para dias e `timestamptz` para instantes, e **uma** função que decide se
algo está atrasado. Nenhuma formatação sem `timeZone` explícito.

Resolve: GLB-002, GLB-001, e os 13 campos de dia guardados como instante.

### 4. i18n no servidor

Erros lançados como **código + parâmetros**, traduzidos na borda conforme o
locale do chamador. O mesmo para timeline e notificações: gravar
`{ type: "PROJECT_CREATED", params: { name } }` em vez da frase pronta.

Resolve: GLB-013, GLB-014.

### 5. Observabilidade

Log estruturado com `requestId`, `userId`, `organizationId` — nunca conteúdo,
nunca `supplierId` de terceiros. Error monitoring capturando o `digest` que já é
exibido ao usuário. Alerta específico em falha de auditoria e em falha do
throttle.

Resolve: OPS-001, e torna OPS-002 detectável.

## Decisões a confirmar antes de começar

| Decisão | Opções | Onde está documentada |
|---|---|---|
| Semântica do prazo | fuso da Vionex / do fornecedor / UTC−12 | [32](32_TIMEZONE_STRATEGY.md) |
| RLS: adotar ou aceitar a ausência | com RLS / sem RLS + lint + teste | [07](07_RLS_AND_MULTITENANCY.md) |
| URLs assinadas para entrega global | desempenho versus chave nunca sair do servidor | [08](08_STORAGE_SECURITY.md) |
| Região dos dados | uma região / por fornecedor | [34](34_DATA_RESIDENCY.md) |
| Exclusão de dado pessoal | anonimizar / excluir | [12](12_DATA_GOVERNANCE.md) |

Nenhuma delas é de engenharia sozinha.
