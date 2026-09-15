import type { StageKey, UserRole } from "@/generated/prisma";

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

const PROJECT_CONTRIBUTOR: Permission[] = [
  ...INTERNAL_READ,
  "project:update",
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

/** Human labels used by Settings → Roles. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Acesso total à plataforma, incluindo usuários, permissões e configurações.",
  MANAGER: "Acesso geral ao portfólio de projetos, fornecedores e relatórios.",
  REGULATORY: "Acesso completo às áreas regulatória e clínica dos projetos.",
  IMPORT: "Acesso completo à área de importação e logística.",
  MARKETING: "Acesso completo à área de Go-to-Market.",
  VIEWER: "Somente leitura em todo o ambiente interno.",
  SUPPLIER_ADMIN: "Administra os usuários do próprio fornecedor no Supplier Portal.",
  SUPPLIER_USER: "Acesso operacional ao Supplier Portal do próprio fornecedor.",
};
