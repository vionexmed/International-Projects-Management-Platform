# 00 — Sumário executivo

**Vionex Projects** · commit `af823ff` · 14 de setembro de 2026
186 arquivos-fonte · 18.038 linhas · 23 models · 2 migrations · 96 testes

---

## As duas respostas

**Pronto para produção? NÃO.**
**Pronto para operação global? PARCIALMENTE.**

---

## O essencial em um parágrafo

Este é um código bem escrito. O modelo de isolamento entre fornecedores — escopos
puros e centralizados, guardas que refazem o escopo dentro da própria consulta,
falha fechada quando a sessão é inválida — é um desenho que eu recomendaria como
referência. Não encontrei IDOR, não encontrei injeção de SQL, não encontrei N+1,
não encontrei segredo versionado, e os cabeçalhos de segurança estão entre os
melhores que já vi num projeto deste porte. **O problema não é a qualidade da
engenharia. É que a porta da frente está aberta**, por uma decisão consciente e
documentada que nunca foi revertida — e nada no sistema força, detecta ou alerta
o momento de revertê-la.

---

## As 18 perguntas

**1. O sistema está pronto para produção?**
Não. Dez bloqueadores, dos quais seis são configuração e guardas de ambiente.

**2. Está pronto para operação global?**
Parcialmente. Um fornecedor alemão ou americano consegue operar, com atrito.
Seis bloqueadores globais.

**3. Qual o maior risco hoje?**
`GET /demo/enter?as=admin` devolve uma sessão de administrador válida, sem senha,
em qualquer ambiente. `src/lib/demo.ts` → `isDemoEnabled()` é `return true;`
literal. Há dois caminhos independentes equivalentes: a senha `vionex123` em
todas as contas do snapshot, e a chave de assinatura publicada no repositório.

**4. Existe risco de perda de dados?**
Sim, e é silencioso. Sem `DATABASE_URL` — inclusive por um espaço em branco no
painel — a aplicação **sobe sobre um Postgres em memória** com dados fictícios, e
`/api/health` responde **200 ok**. Cada instância tem o seu próprio banco; toda
escrita se perde no reciclo. Não existe backup, porque não existe banco.

**5. Existe risco de acesso indevido?**
Entre fornecedores, não — verifiquei as 8 funções de escopo, as 7 guardas e todas
as rotas parametrizadas; todo caminho termina em 404. **Da Vionex para o
fornecedor, sim:** `ProjectStage.notes` e `Project.blockerNote` — campos onde a
equipe interna escreve avaliações sobre o fornecedor — chegam ao navegador dele
no payload RSC.

**6. O banco está saudável?**
Bem modelado, sem drift, sem SQL interpolado. Três defeitos de integridade: uma
FK ausente, o audit log apagado em cascata com a organização, e três políticas
diferentes para o mesmo conceito de autoria.

**7. As migrations estão saudáveis?**
Sim. Duas, limpas, nenhuma editada à mão, contagens conferindo item a item.
**Mas nenhuma etapa do deploy as aplica.**

**8. Multitenancy está seguro?**
Sim na camada de aplicação, e é bem feito. Não há segunda linha: nenhuma RLS, e
16 das 23 tabelas nem têm coluna de tenant para uma política futura se apoiar.

**9. Documents e storage estão seguros?**
Sim, e é o melhor pedaço do sistema. Nada é público, nada tem URL assinada, toda
chave é imprevisível, todo download reaplica o escopo e é auditado. Falta
verificação do conteúdo real dos arquivos e antivírus.

**10. O backend está sustentável?**
Sim. Nenhum arquivo acima de 500 linhas, nenhum god service, nenhuma dependência
circular. A dívida é disciplina de camadas: 11 páginas consultam o banco direto —
todas aplicando o escopo hoje, verificado uma a uma.

**11. A UI/UX está adequada?**
A direção estética foi cumprida de verdade. Dois defeitos sérios no fluxo mais
importante do produto: o formulário é **apagado quando a ação falha** (verificado
no fonte do React), e o upload não tem nenhuma indicação de progresso. Onze pares
de cor falham contraste AA.

**12. Está preparado para a China?**
Melhor do que a maioria, e por evidência: CSP `default-src 'self'` sem **nenhuma**
exceção, fonte auto-hospedada, throttle no servidor em vez de reCAPTCHA. Falta
tipografia CJK e um teste real de rede — que **não é verificável lendo código**.

**13. Timezones estão seguros?**
Não. Nenhum campo é `DATE`, nenhum é `timestamptz`, nenhum usuário tem fuso. O
cálculo de "atrasado" usa o fuso do servidor: o mesmo prazo vira atrasado às
08:00 em Xangai e às 21:00 do dia anterior em São Paulo. **Nenhum dos dois está
certo.**

**14. I18n está preparado?**
A fundação sim — três locales, tipagem que força completude do inglês, todo
rótulo de enum passando pelo dicionário. O produto não a usa: ~520 literais
inline em 66 arquivos, login sempre em português, erros em português, e a
timeline do fornecedor **gravada em português no banco**.

**15. O que bloqueia produção?**
SEC-001, SEC-002, SEC-003 (três caminhos para comprometimento total), DB-007
(perda silenciosa), TEN-002 (campos internos vazando), TEST-001 (os testes de
isolamento não rodam), GOV-001 (CI não instalado), GOV-002 (migrations fora do
deploy), STO-003 (documentos perdidos), OPS-001 (nenhum alerta).

**16. O que bloqueia o rollout internacional?**
GLB-002 (fuso), GLB-012 (login), GLB-013 (erros), GLB-011 (português vazando),
GLB-014 (idioma gravado na linha), GLB-010 (literais).

**17. Quanto realmente precisa mudar?**
Menos do que a lista sugere. **Seis dos dez bloqueadores de produção são
configuração e guardas de ambiente** — um dia de trabalho. O que custa tempo é a
internacionalização e a conversão de tipos de data, e nenhuma das duas bloqueia
um piloto interno.

**18. Qual a ordem ideal?**
Fase A (bloqueadores) e Fase B (backup) em paralelo. Nada mais antes.

---

## Top 5 riscos

| # | Risco | Por quê | Impacto máximo |
|---|---|---|---|
| 1 | **Sessão de ADMIN sem senha** | `isDemoEnabled()` é constante `true` | comprometimento total |
| 2 | **Senha `vionex123` em todas as contas** | embarcada no snapshot pelo script de build | comprometimento total |
| 3 | **Banco em memória alcançável em produção** | uma variável em branco basta; health responde 200 | perda silenciosa de dados |
| 4 | **Avaliação interna visível ao fornecedor** | `getProjectWorkspace` sem `select`, compartilhado pelos dois ambientes | quebra de confiança comercial |
| 5 | **Cegueira operacional** | nenhum logger, nenhum alerta; o `digest` mostrado ao usuário não existe em lugar nenhum | incidente descoberto por reclamação |

## Top 5 pontos fortes

| # | Ponto | Evidência |
|---|---|---|
| 1 | **O isolamento é bem desenhado** | escopo composto dentro da consulta; âncora dupla; `supplierIdOf` que lança em vez de devolver `undefined`; `documentScope` que ignora `Document.supplierId` de propósito |
| 2 | **Cabeçalhos e CSP exemplares** | HSTS com preload, nonce por requisição, `strict-dynamic`, COOP, CORP, `no-store` universal |
| 3 | **Nenhum N+1, nenhum SQL interpolado, nenhum `TODO`, nenhum `console.log`** | verificado por varredura em todo o repositório |
| 4 | **Sessão que relê do banco** | o cookie carrega só identidade; revogar uma conta tem efeito na requisição seguinte |
| 5 | **Comentários que explicam o porquê** | vários documentam uma decisão anterior que deu errado e o motivo — prática rara e valiosa |

## Top 5 bloqueadores de produção

1. SEC-001 — `/demo/enter` (esforço: **horas**)
2. SEC-002 + SEC-003 — senha e chave publicadas (**horas**)
3. DB-007 — banco em memória em produção (**horas**)
4. GOV-001 + GOV-002 — CI não instalado, migrations fora do deploy (**horas**)
5. TEN-002 — campos internos no payload do fornecedor (**horas**)

## Bloqueadores globais principais

1. **GLB-002** — o prazo está errado em todo fuso (**semanas** — é o único de esforço alto)
2. **GLB-012 + GLB-013** — login e erros em português (**dias**)
3. **GLB-014** — idioma gravado na linha (**semanas**, exige mudar o modelo)

---

## Por onde começar

**Fase A**, de [26_MASTER_IMPLEMENTATION_PLAN.md](26_MASTER_IMPLEMENTATION_PLAN.md).
É a única que muda o veredito, a de menor risco técnico e a de maior retorno.
Em paralelo, **Fase B** (backup), porque não depende de código e é pré-requisito
de tudo que toca o banco.

---

## Declaração

**Nenhuma alteração de código, banco, migration, configuração, infraestrutura ou
produção foi realizada.** Os únicos arquivos criados são os desta pasta.
