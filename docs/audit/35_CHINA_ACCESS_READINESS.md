# 35 — Acesso a partir da China

## Nota: 7/10 — o ponto mais forte da auditoria, e por evidência

## Superfície de rede do navegador

Enumerei **todo** recurso que o navegador buscaria. A tabela é curta porque a
resposta é quase sempre "nenhum".

| Dependência | Classificação | Evidência |
|---|---|---|
| **Google Fonts (runtime)** | **LIKELY ACCESSIBLE** | `next/font/google` faz self-host no build. Verificado: 14 `.woff2` em `.next/static/media`; `grep -rl "fonts.gstatic.com\|fonts.googleapis.com" .next/static .next/server` → **zero**. E `font-src 'self' data:` bloquearia um fetch externo de qualquer forma |
| **Google Fonts (build)** | **POTENTIAL CHINA RISK** | `Inter(...)` em `src/app/layout.tsx` exige acesso a `fonts.googleapis.com` **durante `next build`**. Só afeta um CI rodando dentro da China continental; irrelevante para o fornecedor |
| **CDN de script** (cdnjs, jsdelivr, unpkg) | **NENHUM** | `script-src 'self' 'nonce-…' 'strict-dynamic'` em `src/proxy.ts`. Nenhuma URL externa em `src/` além do namespace SVG do w3.org e 4 URLs `*.example.com` no seed |
| **Analytics / telemetria** | **NENHUM** | sem GA, GTM, Segment, Sentry, `@vercel/analytics` ou `speed-insights` |
| **Captcha** | **NENHUM** | e essa é a decisão certa: o reCAPTCHA é bloqueado na China. A proteção é `src/server/auth/throttle.ts`, no servidor |
| **Imagens externas** | **NENHUM** | `img-src 'self' data: blob:`; sem `images.remotePatterns` |
| **XHR/fetch externo** | **NENHUM** | `connect-src 'self'`. O único `fetch` do cliente é `/api/search` |
| **iframes / widgets** | **NENHUM** | `frame-src 'none'`, `frame-ancestors 'none'` |
| **`@aws-sdk/client-s3`** | **UNCERTAIN** | roda só no servidor (`import "server-only"`). O risco não é o firewall do fornecedor, é a latência servidor→bucket se `STORAGE_ENDPOINT` ficar fora da região |
| **Hospedagem (Vercel)** | **REQUIRES REAL-WORLD TEST** | `src/lib/env-schema.ts` referencia `VERCEL_URL`. Acessibilidade, latência e situação de ICP de `*.vercel.app` a partir da China continental **não são verificáveis lendo código.** Nenhuma afirmação é feita aqui |
| **Fonte CJK** | **POTENTIAL CHINA RISK** | `Inter({ subsets: ["latin"] })` e `--font-sans` sem `PingFang SC`/`Microsoft YaHei`/`Noto Sans SC`, sob `<html lang="pt-BR">` fixo |

## Por que isso é incomum

A CSP em `src/proxy.ts` é `default-src 'self'` com **nenhuma exceção de origem**.
Não é uma política permissiva com poucos hosts adicionados — é uma política em
que nada externo é permitido. A maioria dos produtos B2B carrega fontes, um
script de analytics e um captcha; qualquer um dos três quebra na China.

Aqui não há nenhum. Isso não foi planejado para a China — foi consequência de uma
decisão de segurança —, mas o resultado é o mesmo.

## O que falta

1. **Tipografia CJK.** Acrescentar `PingFang SC`, `Microsoft YaHei` e
   `Noto Sans SC` ao stack de fonte, e corrigir `<html lang>` para refletir o
   locale do usuário (UX-006). Com `lang="pt-BR"`, o navegador pode escolher
   glifos Han japoneses para texto chinês.
2. **O chinês no seletor.** O dicionário `zh.ts` já tem 195 linhas de tradução
   legítima cobrindo ~90% do portal. Foi tirado do seletor
   (`SELECTABLE_LOCALES`), mas continua alcançável por server action (GLB-016).
3. **Busca CJK de um caractere.** `src/server/services/search.ts` tem
   `if (query.length < 2) return []`. Um ideograma Han carrega tanta informação
   quanto uma palavra latina de cinco letras.
4. **Ordenação chinesa.** Sem collation declarada, nomes ordenam por code point —
   nem pinyin, nem traços, nem radical. Para o usuário chinês, a lista é aleatória.
5. **Entrega de arquivo.** Todo download atravessa a função, em memória, sem CDN e
   sem `Range`. Num link instável, uma interrupção recomeça do zero.

## Plano de teste real — o que não dá para verificar no código

> Nada abaixo foi executado.

| # | Teste | Como | Critério |
|---|---|---|---|
| 1 | Alcançabilidade | abrir a URL de produção de Xangai, Shenzhen e Pequim, em três operadoras | a página carrega |
| 2 | Tempo até interativo | medir em rede móvel e fixa | < 5 s |
| 3 | Login | entrar com uma conta de fornecedor real | funciona sem captcha |
| 4 | Upload de 20 MB | anexar e submeter uma resposta | conclui; se falhar, o formulário **não pode** ser apagado (UX-001) |
| 5 | Download de 20 MB | baixar um documento | conclui; medir |
| 6 | Interrupção | desligar a rede no meio do download e religar | verificar se retoma ou recomeça |
| 7 | Glifos | renderizar a interface em `zh` | nenhum glifo japonês, nenhum quadrado |
| 8 | Nome de arquivo | baixar `产品说明书.pdf` | chega com o nome correto — a implementação já está certa |
| 9 | Prazo | conferir um `dueDate` de hoje às 09:00 de Xangai | **hoje falha** — ver GLB-002 |
| 10 | ICP | verificar se o domínio exige registro ICP para uso comercial | decisão regulatória, **LEGAL REVIEW REQUIRED** |

Se o teste 1 ou 2 falhar, as opções são um domínio próprio com CDN que atenda a
China, ou hospedagem numa região asiática. **Nenhuma dessas decisões deve ser
tomada antes de medir.**
