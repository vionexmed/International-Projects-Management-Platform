/**
 * Where a supplier's country sits on the globe, by the name it was registered
 * with — Portuguese or English, any case, with or without accents. A country
 * not listed here is simply not drawn.
 */

export type LonLat = [number, number];

/** Point, the name shown on the globe (Portuguese), and every spelling it may be registered with. */
const COUNTRY_POINTS: [LonLat, string, string[]][] = [
  [[114, 23], "China", ["china", "china continental", "prc"]],
  [[114, 22], "Hong Kong", ["hong kong"]],
  [[121, 24], "Taiwan", ["taiwan", "taiwan (roc)"]],
  [[139, 36], "Japão", ["japan", "japao"]],
  [[127, 37], "Coreia do Sul", ["south korea", "korea", "coreia do sul", "coreia"]],
  [[77, 23], "Índia", ["india"]],
  [[104, 1.3], "Singapura", ["singapore", "singapura"]],
  [[101, 15], "Tailândia", ["thailand", "tailandia"]],
  [[106, 16], "Vietnã", ["vietnam", "vietna", "vietname"]],
  [[102, 3], "Malásia", ["malaysia", "malasia"]],
  [[35, 32], "Israel", ["israel"]],
  [[35, 39], "Turquia", ["turkey", "turquia", "turkiye"]],
  [[54, 24], "Emirados Árabes", ["united arab emirates", "uae", "emirados arabes unidos", "emirados arabes"]],
  [[10, 51], "Alemanha", ["germany", "alemanha", "deutschland"]],
  [[12.5, 42], "Itália", ["italy", "italia"]],
  [[2.3, 47], "França", ["france", "franca"]],
  [[-3.7, 40.4], "Espanha", ["spain", "espanha"]],
  [[-8.6, 39.5], "Portugal", ["portugal"]],
  [[-1.5, 53], "Reino Unido", ["united kingdom", "uk", "reino unido", "england", "inglaterra"]],
  [[-8, 53], "Irlanda", ["ireland", "irlanda"]],
  [[8, 47], "Suíça", ["switzerland", "suica"]],
  [[5, 52], "Holanda", ["netherlands", "holanda", "paises baixos"]],
  [[4.5, 50.8], "Bélgica", ["belgium", "belgica"]],
  [[14, 47.5], "Áustria", ["austria"]],
  [[15, 60], "Suécia", ["sweden", "suecia"]],
  [[10, 56], "Dinamarca", ["denmark", "dinamarca"]],
  [[10, 61], "Noruega", ["norway", "noruega"]],
  [[26, 62], "Finlândia", ["finland", "finlandia"]],
  [[19, 52], "Polônia", ["poland", "polonia"]],
  [[15.5, 49.8], "Tchéquia", ["czech republic", "czechia", "republica tcheca", "tchequia"]],
  [[19, 47], "Hungria", ["hungary", "hungria"]],
  [[-95, 38], "Estados Unidos", ["united states", "usa", "us", "estados unidos", "eua", "estados unidos da america"]],
  [[-79, 44], "Canadá", ["canada"]],
  [[-100, 21], "México", ["mexico"]],
  [[-64, -34], "Argentina", ["argentina"]],
  [[-71, -33], "Chile", ["chile"]],
  [[-74, 5], "Colômbia", ["colombia"]],
  [[-56, -34.8], "Uruguai", ["uruguay", "uruguai"]],
  [[-77, -12], "Peru", ["peru"]],
  [[145, -30], "Austrália", ["australia"]],
  [[174, -41], "Nova Zelândia", ["new zealand", "nova zelandia"]],
  [[24, -29], "África do Sul", ["south africa", "africa do sul"]],
];

/** The Portuguese names, for suggestions in the registration forms. */
export const COUNTRY_NAMES: string[] = COUNTRY_POINTS.map(([, name]) => name).sort((a, b) => a.localeCompare(b, "pt-BR"));

/** "Alemanha", "ALEMANHA" and "alemanha " all find the same point. */
export const normalizeCountry = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const COUNTRY = new Map<string, { point: LonLat; name: string }>(
  COUNTRY_POINTS.flatMap(([point, name, spellings]) =>
    [name, ...spellings].map((spelling) => [normalizeCountry(spelling), { point, name }] as const),
  ),
);

export const countryPoint = (name: string): LonLat | undefined => COUNTRY.get(normalizeCountry(name))?.point;

/** São Paulo: where every route ends. */
export const HOME: LonLat = [-46.6, -23.5];

export type RouteOrigin = { country: string; projects: number };
export type Route = { label: string; point: LonLat; projects: number };

/**
 * Supplier countries as routes: unknown names dropped, two spellings of one
 * country merged under its Portuguese name, the busiest routes first.
 */
export function routesFrom(origins: RouteOrigin[]): Route[] {
  const byName = new Map<string, Route>();
  for (const origin of origins) {
    const country = COUNTRY.get(normalizeCountry(origin.country));
    if (!country) continue;
    const route = byName.get(country.name);
    if (route) route.projects += origin.projects;
    else byName.set(country.name, { label: country.name, point: country.point, projects: origin.projects });
  }
  return [...byName.values()].sort((a, b) => b.projects - a.projects || a.label.localeCompare(b.label, "pt-BR"));
}
