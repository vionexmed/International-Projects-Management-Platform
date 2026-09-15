# 31 — Internacionalização e localização

## A fundação é boa. O conteúdo em cima dela é monolíngue.

`src/lib/i18n/` tem tudo o que uma arquitetura de i18n precisa: três locales
(`pt-BR`, `en`, `zh`), coluna `Language` por usuário no banco, cadeia de
fallback, `interpolate()`, `plural()`, e — o melhor pedaço — `src/lib/labels.ts`,
onde **todo rótulo de enum passa pelo dicionário** e nenhum está hardcoded.
`src/lib/status.ts` separa corretamente *tone* (visual, independente de idioma)
de *label* (texto).

O problema é que o produto não usa essa fundação para a maior parte do texto.

## GLB-010 — ~520 literais hardcoded em 66 arquivos · **HIGH**

| Área | Arquivos | Literais distintos |
|---|---:|---:|
| `src/app/(internal)/**` | 23 | 269 |
| `src/features/**` | 22 | 206 |
| `src/components/**` | 11 | 21 |
| `src/app/(supplier)/**` | 5 | 8 |
| **Total UI** | **66** | **~520** |
| `src/server/**` (mensagens PT) | — | 84 |

Piores ofensores: `settings/page.tsx` (33), `dashboard/page.tsx` (24),
`reports/page.tsx` (22), `suppliers/[supplierId]/page.tsx` (21),
`new-project-dialog.tsx` (20).

O padrão é sempre o mesmo: a página **já resolve** `locale` e `dict`
corretamente, e os usa só para rótulos de enum e datas — toda a cópia ao redor é
inline.

O próprio dicionário admite a dívida, em `src/lib/i18n/dictionaries/pt-BR.ts`:

> *"the internal environment ships in Portuguese for the MVP, so page-level
> internal copy is written inline in those components."*

Essa é uma decisão de MVP defensável. Deixa de ser quando a equipe internacional
precisar operar o ambiente interno.

## GLB-011 — Português vaza para dentro do Supplier Portal · **HIGH**

Componentes compartilhados importados por rotas `(supplier)`:

| Arquivo | Texto em português | Onde aparece para o fornecedor |
|---|---|---|
| `src/components/app/demo-banner.tsx` | "Demonstração", "Dados fictícios · acesso sem senha habilitado", "Trocar de usuário" | **primeira faixa do topo do portal** |
| `src/components/app/file-dropzone.tsx` | "Formato não permitido. Use: …", "O arquivo excede … MB.", "Remover arquivo" | no envio de documento |
| `src/components/app/form-dialog.tsx` | "Cancelar" | todos os diálogos do portal |
| `src/components/ui/dialog.tsx` | `aria-label="Fechar"` (2×) | leitores de tela |
| `src/components/app/tabs-nav.tsx` | `aria-label="Abas"` | navegação por abas |
| `src/components/app/pagination.tsx` | "Exibindo {from} a {to} de {total}" | listas paginadas — **apesar de `dict.common.showingRange` existir** |
| `src/app/not-found.tsx` | "Erro 404", "Página não encontrada.", "Voltar ao dashboard" | 404 global — e o link aponta para `/dashboard`, que o fornecedor não pode acessar |

E o inverso: `src/app/(supplier)/supplier/error.tsx` e o rodapé do layout do
portal ("All rights reserved.", "Privacy policy", "Terms of use") estão em
**inglês hardcoded, fora do dicionário** — um fornecedor em `zh` os lê em inglês.

## GLB-012 — A tela de login está sempre em português · **HIGH**

`src/app/(auth)/login/page.tsx`:

```ts
const locale = DEFAULT_INTERNAL_LOCALE;   // "pt-BR", fixo
```

Não há cookie, não há `Accept-Language` (`grep -rni "accept-language|navigator.language" src` → **zero**), não há seletor.

Um fornecedor em Munique ou Xangai encontra, **na primeira e única tela antes de
se autenticar**: "Bem-vindo de volta", "Acesse o Vionex Projects.", "E-mail",
"Senha", "Manter conectado", "Entrar", "Esqueceu a senha?", "© 2026 Vionex.
Todos os direitos reservados."

A ironia: `LoginForm` **aceita** a prop `locale`, e `signIn` **lê**
`formData.get("locale")`. A flexibilidade está construída e nunca é exercida.

## GLB-013 — Mensagens de erro do servidor chegam em português · **HIGH**

Caminho verificado de ponta a ponta: o fornecedor submete uma resposta vazia →
`src/lib/upload.ts` / `src/server/services/documents.ts` lança →
`toActionError` (`src/server/actions/utils.ts`) devolve a mensagem crua →
`src/features/supplier-portal/submit-request-form.tsx` renderiza `{state.error}`.

Fontes de mensagem em português alcançáveis pelo portal:

| Arquivo | Exemplos |
|---|---|
| `src/server/actions/utils.ts` | "Verifique os campos destacados.", "Já existe um registro com estes dados.", "Algo deu errado. Tente novamente." |
| `src/server/authz/errors.ts` | "Você não tem permissão para executar esta ação.", "Sessão expirada. Faça login novamente." |
| `src/server/authz/access.ts` | as 7 mensagens de escopo: "Projeto não encontrado.", "Arquivo não encontrado."… |
| `src/server/services/documents.ts` | "Esta solicitação foi cancelada.", "Anexe um arquivo ou escreva uma resposta." |
| `src/lib/upload.ts` | "O arquivo está vazio.", "Tipo de arquivo não permitido." |
| `src/server/actions/auth.ts` | "Muitas tentativas. Aguarde N minutos…" — escapa do `dict` que a própria função já resolveu |

## GLB-014 — O idioma está gravado na linha, não escolhido na renderização · **HIGH**

Este é o problema mais estrutural, porque **não é corrigível em runtime**.

`timelineScope` (`src/server/authz/scopes.ts`) entrega ao fornecedor todo evento
com `internal: false`. `recordTimelineEvent` (`src/server/services/timeline.ts`)
usa `internal: input.internal ?? false`, e **verifiquei: nenhuma das chamadas em
`src/server/services/` passa `internal: true`** (as únicas ocorrências de
`internal: true` no repositório são comentários de tarefa no seed de
demonstração).

Portanto o histórico inteiro do projeto é visível ao fornecedor — e está escrito
em português, gravado no banco:

```
"Projeto Product Alpha criado."
"Tarefa \"Clinical protocol\" criada."
"Certificate of Analysis enviado pelo fornecedor."
"Status do projeto alterado para on track."     ← frase PT + enum EN cru
```

As notificações (`notify`, `src/server/services/notifications.ts`) têm o mesmo
problema com um agravante de **inconsistência**: as dirigidas ao fornecedor estão
em inglês fixo (`"New request for ${project.name}."`), as internas em português
(`"Nova tarefa em ${project.name}."`). Nenhuma das duas muda quando o usuário
troca de idioma.

Corrigir isso exige mudar o modelo: gravar um **código de evento + parâmetros**
(`{ type: "PROJECT_CREATED", params: { name } }`) e traduzir na leitura. Os dados
já existentes precisariam de migração ou ficariam congelados.

## GLB-015 — `getDictionary` entrega chinês para qualquer locale novo · **HIGH (latente)**

`src/lib/i18n/dictionary.ts`:

```ts
const resolved =
  locale === "pt-BR" ? base : locale === "en" ? english : merge(english, zh);
```

O braço final é **incondicionalmente `zh`**. Acrescentar `"de"` ou `"es"` a
`LOCALES` compila sem nenhum erro e entrega o **dicionário chinês** ao usuário
alemão.

Hoje isso não prejudica ninguém — `LOCALES` tem exatamente os três locales
tratados. Por isso classifico como **latente**: vira um defeito ativo no dia em
que alguém adicionar o quarto idioma, que é precisamente o objetivo declarado.

O comentário logo acima diz *"Adding a locale means dropping a file in
`dictionaries/` and registering it here; no page needs to change"* — descreve uma
intenção que o código não cumpre com segurança.

## GLB-016 — `zh` alcançável apesar de removido do seletor · **MEDIUM**

`SELECTABLE_LOCALES = ["pt-BR", "en"]` tira o chinês do dropdown. Mas
`src/server/actions/preferences.ts` valida com `isLocale`, que checa contra
`LOCALES` — **e `LOCALES` inclui `"zh"`**. Um POST com `locale=zh` grava
`language = ZH` e o portal passa a renderizar em chinês.

O bloqueio é apenas cosmético. Como o dicionário `zh.ts` cobre ~90% do portal com
tradução de boa qualidade, o resultado não é catastrófico — mas é um estado que
ninguém pretendeu e que ninguém testa.

## Unicode

| Aspecto | Situação |
|---|---|
| Armazenamento | **OK** — colunas `TEXT`, UTF-8 |
| `DocumentVersion.fileName` | **OK** — nome original preservado; a sanitização atinge só a chave opaca de storage |
| `Content-Disposition` | **correto** — `filename*=UTF-8''` (RFC 5987). Um arquivo `产品说明书.pdf` chega com o nome certo. Falta apenas o `filename=` ASCII de fallback da RFC 6266 |
| CSV | **OK** — BOM + `charset=utf-8` |
| **Collation** | **indefinida** — nenhuma declaração nas migrations. Nomes chineses ordenam por *code point*: nem pinyin, nem traços, nem radical. Para o usuário chinês a lista é aleatória |
| **Acentos na busca** | **quebrado** — `ILIKE` dobra caixa mas não dobra acento. `"sao"` não encontra `"São Paulo"`. Sem `unaccent`, sem `citext` |
| **Normalização** | **ausente** — `grep` por `normalize(`/`localeCompare`/`Intl.Collator` → zero. Texto NFD do macOS não casa com NFC |
| **Busca CJK de 1 caractere** | **rejeitada** — `src/server/services/search.ts` tem `if (query.length < 2) return []`. Um ideograma Han carrega tanta informação quanto uma palavra latina |
| **Fonte CJK** | **ausente** — `Inter({ subsets: ["latin"] })` e `--font-sans` sem `PingFang SC`/`Noto Sans SC`, sob `<html lang="pt-BR">` fixo. O navegador pode escolher glifos Han japoneses |

## Países, moedas, telefones, endereços

| Domínio | Situação | Evidência |
|---|---|---|
| **País** | **texto livre, não ISO 3166** | `Supplier.country String`, `Project.country String`, preenchidos por `<Input>` puro em `new-supplier-dialog.tsx` e `new-project-dialog.tsx`. `src/server/services/projects.ts` → `listProjectCountries` usa os valores distintos como faceta de filtro — "China", "china", "PRC", "中国" viram quatro filtros diferentes |
| **Moeda** | **inexistente** | nenhum campo monetário, nenhum `Decimal`, nenhum `Intl.NumberFormat`. Não há dívida porque não há moeda — mas uma plataforma que rastreia importação e Go-to-Market vai precisar (valor FOB, incoterm, câmbio) e não há fundação |
| **Telefone** | **texto livre** | `Supplier.phone String?`, `<Input>` sem `type="tel"`, sem validação. Os dados de seed usam E.164 informal por convenção, não por imposição |
| **Endereço** | **internacional, por acerto** | `Supplier.address String?` é um `<Textarea>` livre. **Não há CEP, estado, CNPJ ou CPF em lugar nenhum** — `grep -rniE "cnpj\|cpf\|\bcep\b"` → zero. Este é o aspecto mais bem resolvido do domínio internacional |

## UX em inglês — problemas concretos para um leitor não nativo

1. **`"You're all caught up."`** — idioma coloquial, e diz menos que o original
   português ("Tudo em dia. Nenhuma solicitação pendente.").
2. **Quatro grafias de "Action Required"** entre navegação, cabeçalho e aba:
   `"Action Required"`, `"Action required"`, `"Action required"`, `"Action Required"`.
   Descuido visível num portal B2B.
3. **`"KOLs"`** — sigla não expandida em nenhum dos três idiomas.
4. **`"Go-to-Market"`** — nome de uma das quatro etapas centrais, idêntico em pt,
   en e zh. O fornecedor chinês vê uma etapa cujo nome não está no idioma dele.
5. **`"Reply / Comment"`** — a barra deixa ambíguo se são um campo ou dois.
6. **`"Contact Vionex team"`** — falta o artigo.
7. **Interpolação que quebra a gramática chinesa:**
   `(supplier)/supplier/projects/(index)/page.tsx` compõe
   `interpolate(dict.common.showingRange, { total: "${total} ${countLabel}" })`.
   Em zh isso produz `共 12 个项目 条` — classificador duplicado, chinês
   agramatical. Compor duas strings traduzidas independentes só funciona entre
   línguas de sintaxe parecida.

## Contexto brasileiro que o fornecedor vê

- A tela de login inteira (GLB-012).
- O 404 global em português, apontando para `/dashboard`.
- A faixa de demonstração no topo do portal.
- A timeline inteira do projeto (GLB-014).
- Dados de seed com contexto regulatório brasileiro que chegam ao portal:
  *"Registro e importação junto à ANVISA"*, *"IFU em português e inglês para
  submissão à ANVISA."*, *"Hospital São Lucas"*.
- Cabeçalhos de CSV fixos em português, ainda que a rota já tenha resolvido o
  `dict` do usuário e o use nas células.

## Não há seletor de idioma no ambiente interno

`SELECTABLE_LOCALES` só é consumido em `src/components/app/supplier-sidebar.tsx`.
`src/app/(internal)/settings/page.tsx` mostra "Idioma padrão" apenas como
leitura. Um gerente da Vionex que prefira inglês não tem como mudar pela
interface — e a equipe internacional da Vionex é justamente quem precisaria.
