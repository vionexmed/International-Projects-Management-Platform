/**
 * The assistant's reading of a question — no model, no network: the words
 * people use about this platform, matched against the projects, companies and
 * people the asker can see. Pure, so every phrasing it understands is tested.
 */

export type AssistantIntent =
  | "greeting"
  | "help"
  | "status"
  | "needs"
  | "overdue"
  | "documents"
  | "review"
  | "deadlines"
  | "milestones"
  | "blocked"
  | "activity"
  | "mine"
  | "portfolio"
  | "unknown";

export type Named = { id: string; name: string; code?: string };

export type Catalog = {
  projects: Named[];
  suppliers: Named[];
  people: Named[];
};

export type Understanding = {
  intent: AssistantIntent;
  projectId?: string;
  supplierId?: string;
  personId?: string;
  /** Days ahead for "prazos": a week unless the question says month. */
  horizon: number;
};

/** Lower case, no accents, no punctuation, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const hasWord = (text: string, phrase: string) => new RegExp(`(^|\\s)${phrase}(\\s|$)`).test(text);

/* Words too common in names to identify anything on their own. */
const GENERIC = new Set([
  "product", "produto", "projeto", "project", "manufacturer", "fabricante", "fornecedor", "supplier",
  "ltda", "inc", "co", "company", "empresa", "group", "grupo", "medical", "de", "da", "do", "the", "and",
]);

function distinctive(name: string) {
  return normalize(name)
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC.has(token));
}

/** Best match of a catalog entry in the text: the full name, a code, or a telling word of the name. */
function find(text: string, entries: Named[], { byToken = true } = {}): string | undefined {
  // Codes first: "vx-001", "vx 001", "vx1".
  const code = text.match(/\bvx[\s-]?0*(\d{1,4})\b/);
  if (code) {
    const hit = entries.find((entry) => entry.code && normalize(entry.code).replace(/\D/g, "").replace(/^0+/, "") === code[1]);
    if (hit) return hit.id;
  }
  let best: { id: string; score: number } | undefined;
  for (const entry of entries) {
    const full = normalize(entry.name);
    let score = 0;
    if (full && hasWord(text, full)) score = 100 + full.length;
    else if (byToken) {
      const tokens = distinctive(entry.name).filter((token) => hasWord(text, token));
      if (tokens.length > 0) score = tokens.reduce((total, token) => total + token.length, 0);
    }
    if (score > 0 && (!best || score > best.score)) best = { id: entry.id, score };
  }
  return best?.id;
}

/* Ordered: the first rule whose words appear decides the intent. */
const RULES: [AssistantIntent, RegExp][] = [
  ["help", /\b(ajuda|help|o que (voce|vc) (faz|sabe)|como (voce|vc) funciona|o que posso perguntar)\b/],
  ["activity", /\b(aconteceu|atualiza\w*|novidade\w*|historico|ultimas?|mudou|mudanca\w*|movimenta\w*)\b/],
  ["review", /\b(analis\w*|revis\w*|aprovar|para aprovar|pra aprovar)\b/],
  ["blocked", /\b(bloque\w*|travad\w*|impedid\w*)\b/],
  ["documents", /\b(document\w*|arquivo\w*|certificad\w*|laudo\w*|enviou|enviar|mandou|deve(m)?)\b/],
  ["overdue", /\b(atras\w*|vencid\w*|late|estourad\w*)\b/],
  ["milestones", /\b(marco\w*|milestone\w*|lancament\w*|lanca)\b/],
  ["deadlines", /\b(prazo\w*|vence\w*|vencimento\w*|essa semana|esta semana|este mes|esse mes|agenda|entregas?)\b/],
  ["mine", /\b(minhas?|meus?|pra mim|para mim|eu tenho|comigo)\b/],
  ["needs", /\b(precisa\w*|falta\w*|pendent\w*|pendencia\w*|o que fazer|proximos passos|proximo passo)\b/],
  ["portfolio", /\b(portfolio|todos os projetos|visao geral|panorama|carteira)\b/],
  ["status", /\b(como (esta|estao|anda|andam|vai|vao)|status|situacao|resumo|andamento|progresso|quem e (o )?responsavel|responsavel)\b/],
];

const GREETING = /^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|hey|hello|hi)\b/;

export function understand(question: string, catalog: Catalog): Understanding {
  const text = normalize(question);
  const horizon = /\b(mes|30 dias|mensal)\b/.test(text) ? 30 : /\b(hoje|amanha)\b/.test(text) ? 2 : 7;

  const projectId = find(text, catalog.projects);
  const supplierId = find(text, catalog.suppliers);
  // People only by a name actually written: first names are too short to guess at.
  const personId = find(text, catalog.people.map((person) => ({ ...person, name: person.name })), { byToken: true });

  const matched = RULES.find(([, pattern]) => pattern.test(text))?.[0];
  let intent: AssistantIntent = matched ?? "unknown";

  if (!matched) {
    if (GREETING.test(text)) intent = "greeting";
    // A name on its own ("Product Alpha?") is a request for its status.
    else if (projectId || supplierId) intent = "status";
  }
  // "Minhas tarefas atrasadas" is about the asker's late work.
  if (intent === "mine" && /\b(atras\w*|vencid\w*)\b/.test(text)) intent = "overdue";

  return {
    intent,
    projectId,
    // A project named in the question outranks its supplier's name inside it.
    supplierId: projectId ? undefined : supplierId,
    personId: intent === "mine" ? undefined : personId,
    horizon,
  };
}
