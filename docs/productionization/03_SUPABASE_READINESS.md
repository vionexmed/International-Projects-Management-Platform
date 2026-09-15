# Prontidão para Supabase PostgreSQL

Auditoria do código atual contra as características do Supabase. **Nada foi
alterado no schema por causa do provedor.**

## Veredito

**Compatível.** Nenhuma incompatibilidade encontrada. Três pontos exigem
configuração correta (não mudança de código) e estão detalhados abaixo.

## Item a item

| Item | Situação | Observação |
|---|---|---|
| Versão do Prisma | 7.10 com `@prisma/adapter-pg` | Driver adapter fala `pg` puro; sem engine binária no runtime |
| Extensões Postgres | **nenhuma exigida** | Sem `citext`, `pgcrypto`, `uuid-ossp`, PostGIS. Ids são `cuid()` da aplicação |
| Schemas | só `public` | Sem `@@schema`, sem multiSchema — nada colide com os schemas internos do Supabase |
| Enums | 23 | Suportados nativamente |
| Foreign keys | 48, com `Restrict`/`Cascade`/`SetNull` | Postgres padrão |
| Índices | B-tree simples e únicos compostos | Nenhum GIN/GiST |
| Transações | 7 interativas (`$transaction(fn)`) | Funcionam em pooler de transação; cada uma segura uma conexão enquanto dura |
| `Serializable` | 1 uso (`users.ts`, proteção de último administrador) | `BEGIN ISOLATION LEVEL SERIALIZABLE` dentro da transação — suportado |
| SQL cru | 2 usos, ambos diagnóstico (`SELECT 1`, contagem de migrations) | Sem dependência de recurso proprietário |
| Advisory locks | só o Prisma Migrate usa | Por isso migrations exigem conexão **não** em modo transação |
| SSL | exigido pelo Supabase | Vem na própria connection string; `pg` respeita `sslmode` |
| Suposições de horário | nenhuma dependente do banco | `now()` vem da aplicação; prazos são data em UTC |

## Os três pontos de atenção

**1. Pooler × conexão direta.** `prisma migrate` precisa de advisory locks de
nível de sessão, que um pooler em *transaction mode* não oferece. Por isso
`DATABASE_URL` (runtime, pooler) e `DIRECT_URL` (migrations) são variáveis
separadas — já previsto em `prisma.config.ts` desde antes desta fase.

**2. IPv6 na conexão direta.** O host direto do Supabase
(`db.<ref>.supabase.co`) resolve para IPv6. Runners do GitHub Actions são
IPv4-only, então uma migration rodada de lá contra o host direto falha por
rede, não por permissão. A saída é o **Session pooler** (porta 5432 no host
`...pooler.supabase.com`), que é IPv4 e mantém sessão — servindo para
migrations. Registrado aqui porque falha nesse ponto se parece com erro de
credencial e não é.

**3. Senha na URL.** O Supabase gera senhas fortes; caracteres como `@`, `/`,
`#` e `?` precisam ser **percent-encoded** dentro da connection string, ou o
parse quebra de formas confusas.

## O que NÃO faremos

- **Não** usar `supabase-js` para acesso a dados. A aplicação é Prisma +
  Server Components, e trocar isso reescreveria a camada onde o isolamento
  entre fornecedores vive.
- **Não** usar Supabase Auth. O produto tem sessão própria; dois sistemas de
  identidade convivendo é exatamente como um fornecedor acaba vendo o projeto
  de outro.
- **Não** habilitar RLS pela metade. Ou fica desligada — e a aplicação
  continua sendo a fronteira, como é hoje e como os 160 testes de integração
  verificam — ou é escrita por completo, como defesa em profundidade, em
  rodada própria. RLS parcial dá sensação de proteção sem a proteção.
