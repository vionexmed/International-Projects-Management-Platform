# 30 — Prontidão global

## Veredito: **PARTIALLY**

A fundação internacional existe e, num aspecto — o acesso da China —, é melhor do
que na maioria dos produtos. O que falta é que o produto **use** a fundação que
já tem, e uma correção de fuso horário que hoje deixa o prazo errado para todo
mundo.

## Notas

| Dimensão | Nota | Justificativa em uma linha |
|---|---:|---|
| Internationalization | **4** | fundação boa, ~520 literais inline em 66 arquivos por cima dela |
| Localization | **5** | pt-BR e en completos e tipados; texto persistido com idioma congelado |
| Timezone Safety | **3** | nenhum campo `DATE`, nenhum `timestamptz`, nenhum fuso de usuário, "atrasado" errado em todo fuso |
| Unicode Support | **6** | armazena e entrega corretamente; não ordena, não busca sem acento, sem fonte CJK |
| Global UX | **4** | login em português, erros em português, timeline em português |
| China Readiness | **7** | CSP `default-src 'self'` sem exceções, fonte self-hosted, throttle em vez de captcha |
| Global Performance | **4** | todo arquivo trafega pela função, em memória, sem CDN e sem `Range` |
| Global File Delivery | **3** | sem retomada, sem multipart, sem progresso |
| Data Residency Awareness | **2** | nenhum mapa de fluxo, nenhuma decisão de região registrada |
| International Privacy | **3** | sem caminho de exclusão, sem retenção, sem mapa |
| Global Auth/Security | **4** | sem MFA, sem revogação, sem visibilidade de sessão ou dispositivo |

## A plataforma está pronta para fornecedores do mundo inteiro?

**PARCIALMENTE.** Um fornecedor alemão ou americano consegue operar hoje, com
atrito: veria a tela de login em português, erros em português, a timeline em
português e um prazo marcado como atrasado antes da hora. Um fornecedor chinês
teria tudo isso mais a ausência de tipografia CJK e o chinês fora do seletor.

Nada disso é intransponível. Mas hoje o produto comunica "software brasileiro com
uma tradução" e não "plataforma internacional" — que é exatamente a distinção
que a auditoria pediu para avaliar.

## Os 6 bloqueadores globais

| # | Bloqueador | Por que bloqueia |
|---|---|---|
| **GLB-002** | "Atrasado" calculado no fuso do servidor | O fornecedor chinês vê "Overdue" em vermelho durante o dia útil inteiro em que o prazo ainda corre. Contamina o status do portfólio. Ver [32_TIMEZONE_STRATEGY.md](32_TIMEZONE_STRATEGY.md) |
| **GLB-012** | Tela de login sempre em português | É a **primeira e única tela** antes da autenticação, para todo fornecedor internacional |
| **GLB-013** | Erros do servidor em português | O fornecedor recebe "Anexe um arquivo ou escreva uma resposta." em português no momento em que precisa entender o que deu errado |
| **GLB-011** | Português vazando pelos componentes compartilhados | A faixa no topo do portal, os erros de upload, "Cancelar", `aria-label="Fechar"`, o 404 |
| **GLB-014** | Idioma gravado na linha (timeline, notificações) | Não é corrigível em runtime — exige mudar o modelo para código de evento + parâmetros |
| **GLB-010** | ~520 literais hardcoded | Impede a equipe internacional da Vionex de operar o ambiente interno |

## O que já está certo e deve ser preservado

| Acerto | Evidência |
|---|---|
| **Superfície de rede limpíssima** | CSP `default-src 'self'` **sem uma única exceção de origem**. Nenhum CDN, nenhum analytics, nenhum captcha, nenhum iframe, nenhuma imagem externa. O único `fetch` do cliente é `/api/search` |
| **Fonte auto-hospedada** | `next/font/google` faz self-host no build: 14 `.woff2` em `.next/static/media`, zero referência a `gstatic` no bundle |
| **Throttle em vez de reCAPTCHA** | `src/server/auth/throttle.ts` — decisão que sobrevive na China, onde o reCAPTCHA é bloqueado |
| **Nome de arquivo internacional** | `filename*=UTF-8''` (RFC 5987) em `/api/files` — `产品说明书.pdf` chega com o nome certo |
| **CSV com BOM** | acentos abrem corretamente no Excel |
| **Endereço não é brasileiro** | `Supplier.address` é texto livre. **Zero ocorrências de CEP, CNPJ ou CPF** em todo o repositório |
| **Arquitetura de dois ambientes** | interno em português, portal em inglês — a decisão de produto certa |
| **Dicionário `zh` já existe** | 195 linhas de tradução legítima cobrindo ~90% do portal |

## Entrega global de arquivos

Hoje todo download atravessa a função serverless, inteiro em memória, sem CDN,
sem suporte a `Range` e sem retomada. Um fornecedor em Xangai baixando 25 MB de
uma região dos EUA, numa rede instável, recomeça do zero a cada interrupção.

A dependência `@aws-sdk/s3-request-presigner` **já está instalada e não é
usada** — é exatamente a peça para URLs assinadas de curta duração. A troca
precisa ser consciente: ganha-se desempenho global e perde-se a propriedade de
que a chave do objeto nunca sai do servidor. Ver [08_STORAGE_SECURITY.md](08_STORAGE_SECURITY.md).
