/**
 * The seeded accounts a demonstration can enter without a password, as the
 * `/demo` page and the "Mudar pessoa" switcher list them. The keys are the
 * ones `/demo/enter?as=` accepts.
 */
export type DemoAccount = { key: string; name: string; role: string; note: string };

export const DEMO_INTERNAL: DemoAccount[] = [
  { key: "admin", name: "Lucas Silva", role: "Administrador", note: "Acesso total à plataforma" },
  { key: "regulatory", name: "Stefany Rocha", role: "Regulatório", note: "Áreas regulatória e clínica" },
  { key: "manager", name: "João Mendes", role: "Gestor", note: "Portfólio e fornecedores" },
  { key: "marketing", name: "Maria Santos", role: "Marketing", note: "Go-to-Market" },
  { key: "viewer", name: "Paulo Reis", role: "Visualizador", note: "Somente leitura" },
];

export const DEMO_SUPPLIERS: DemoAccount[] = [
  { key: "emily", name: "Emily Carter", role: "Manufacturer C · Estados Unidos", note: "Só enxerga os projetos da C" },
  { key: "supplier", name: "John Smith", role: "Manufacturer A · Administrador", note: "Tem solicitações pendentes e gere os usuários da empresa" },
  { key: "supplier-user", name: "Wei Zhang", role: "Manufacturer A · Usuário", note: "Mesmos projetos, sem gerir usuários" },
  { key: "klaus", name: "Klaus Weber", role: "Manufacturer B · Alemanha", note: "Só enxerga os projetos da B" },
];
