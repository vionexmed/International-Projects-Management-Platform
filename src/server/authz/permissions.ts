import type { DocumentType, StageKey, UserRole } from "@/generated/prisma";
import { ForbiddenError } from "@/server/authz/errors";

/**
 * Capability-based permissions. Roles are fixed in the schema; the mapping
 * from role to capability lives here so that every server action can ask a
 * single question ("can this user do X?") and so the matrix is unit-testable.
 */
export const PERMISSIONS = [
  "project:read",
  "project:create",
  "project:update",
  "project:archive",
  "task:read",
  "task:create",
  "task:update",
  "document:read",
  "document:upload",
  "document:request",
  "document:review",
  "clinical:manage",
  "regulatory:manage",
  "import:manage",
  "gtm:manage",
  "supplier:read",
  "supplier:manage",
  "message:send",
  "report:read",
  "team:read",
  "user:manage",
  "settings:manage",
  "portal:access",
  "portal:manage-users",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const INTERNAL_READ: Permission[] = [
  "project:read",
  "task:read",
  "document:read",
  "supplier:read",
  "report:read",
  "team:read",
];

const STAGE_MANAGE: Permission[] = [
  "clinical:manage",
  "regulatory:manage",
  "import:manage",
  "gtm:manage",
];

/**
 * What a domain specialist can do on any project (PERM-1).
 *
 * `project:update` is deliberately absent. It governs the project's general
 * data — name, dates, owner, status, blocker note — which belongs to whoever
 * runs the project, not to whoever owns one of its four stages. It used to be
 * here, which meant the Marketing role could change a project's status and
 * rewrite its blocker note; each specialist now edits their own stage through
 * `STAGE_PERMISSION` and nothing else.
 */
const PROJECT_CONTRIBUTOR: Permission[] = [
  ...INTERNAL_READ,
  "task:create",
  "task:update",
  "document:upload",
  "document:request",
  "document:review",
  "message:send",
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    ...PROJECT_CONTRIBUTOR,
    ...STAGE_MANAGE,
    "project:update",
    "project:create",
    "project:archive",
    "supplier:manage",
  ],
  REGULATORY: [...PROJECT_CONTRIBUTOR, "regulatory:manage", "clinical:manage", "project:create"],
  IMPORT: [...PROJECT_CONTRIBUTOR, "import:manage"],
  MARKETING: [...PROJECT_CONTRIBUTOR, "gtm:manage"],
  VIEWER: INTERNAL_READ,
  SUPPLIER_ADMIN: [
    "portal:access",
    "portal:manage-users",
    "project:read",
    "task:read",
    "document:read",
    "document:upload",
    "message:send",
  ],
  SUPPLIER_USER: [
    "portal:access",
    "project:read",
    "task:read",
    "document:read",
    "document:upload",
    "message:send",
  ],
};

export function roleHas(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * The same question, asked where the write happens.
 *
 * Server actions check capabilities before calling a service, which is right
 * but not sufficient: a service reached by any other route — another service,
 * a route handler, a script, a future caller — was governed only by the scope,
 * and a scope answers "whose data is this", never "may you change it". A
 * VIEWER could create a task that way.
 */
export function assertRoleCan(role: UserRole, permission: Permission) {
  if (!roleHas(role, permission)) {
    throw new ForbiddenError("Seu perfil não permite esta ação.");
  }
}

/**
 * Which capability governs each stage.
 *
 * `STAGE_MANAGE` already declares that the four stages are separate
 * responsibilities, and the stage *detail* actions — clinical study, regulatory
 * items, shipments, GTM items — have always enforced it. The stage itself did
 * not: editing its status, progress and notes asked only for `project:update`,
 * which every contributor has. So a colleague from Import could mark the
 * clinical stage complete and write in its notes, which is precisely what the
 * declared matrix says should not happen.
 *
 * Mapping the stage to its owner closes that gap without inventing anything:
 * the permissions already exist, and ADMIN and MANAGER hold all four, so
 * nothing changes for them.
 */
export const STAGE_PERMISSION: Record<StageKey, Permission> = {
  CLINICAL: "clinical:manage",
  REGULATORY: "regulatory:manage",
  IMPORT_LOGISTICS: "import:manage",
  GO_TO_MARKET: "gtm:manage",
};

/**
 * The roles that run a project rather than one of its stages.
 *
 * Used where a decision cannot be attributed to a single domain and the
 * product has to fail closed rather than guess — see
 * `canReviewDocumentType`.
 */
const ADMINISTRATIVE_ROLES: readonly UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Which domain owns the review of each kind of document (PERM-2).
 *
 * Reviewing a submitted document was governed by one flat capability, so
 * whoever could review a certificate of analysis could also approve a customs
 * invoice and a marketing deck. The type of the request already says which
 * domain it belongs to, and the four domain capabilities already exist — this
 * maps one to the other rather than inventing a second authorization scheme.
 *
 * `null` means the type does not identify a domain. A contract, an NDA or an
 * "other" document could belong to anyone, so the product refuses to guess:
 * only the administrative roles may review those. Fail closed, deliberately —
 * guessing wrong here means a document is approved by someone with no standing
 * to approve it, and an approval is exactly the thing a regulatory file is
 * supposed to be able to trust.
 */
export const DOCUMENT_REVIEW_DOMAIN: Record<DocumentType, Permission | null> = {
  CLINICAL: "clinical:manage",
  REGULATORY: "regulatory:manage",
  CERTIFICATE: "regulatory:manage",
  IFU: "regulatory:manage",
  IMPORT: "import:manage",
  COMMERCIAL: "gtm:manage",
  PRESENTATION: "gtm:manage",
  CONTRACT: null,
  NDA: null,
  OTHER: null,
};

/** Whether this role may decide on a submitted document of this type. */
export function canReviewDocumentType(role: UserRole, type: DocumentType) {
  // The capability to review at all: never a supplier, never a VIEWER.
  if (!roleHas(role, "document:review")) return false;

  const domain = DOCUMENT_REVIEW_DOMAIN[type];
  if (domain === null) return ADMINISTRATIVE_ROLES.includes(role);
  return roleHas(role, domain);
}

/** Human labels used by Settings → Roles. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Acesso total à plataforma, incluindo usuários, permissões e configurações.",
  MANAGER: "Acesso geral ao portfólio de projetos, fornecedores e relatórios.",
  REGULATORY:
    "Áreas regulatória e clínica dos projetos: etapas, solicitações e análise dos documentos desses domínios.",
  IMPORT: "Área de importação e logística: etapa, tarefas e análise dos documentos de importação.",
  MARKETING: "Área de Go-to-Market: etapa, tarefas e análise dos materiais comerciais.",
  VIEWER:
    "Somente leitura em todo o ambiente interno, incluindo documentos internos dos projetos a que tem acesso. Não cria, edita, aprova nem administra.",
  SUPPLIER_ADMIN: "Administra os usuários do próprio fornecedor no Supplier Portal.",
  SUPPLIER_USER: "Acesso operacional ao Supplier Portal do próprio fornecedor.",
};
