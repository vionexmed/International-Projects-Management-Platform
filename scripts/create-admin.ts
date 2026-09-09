import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { createSeedClient } from "../prisma/seed-helpers";

/**
 * Creates the first real administrator — the production counterpart to the
 * demo seed, which is blocked outside development.
 *
 * It is additive: it never deletes anything, refuses to overwrite an existing
 * account, and reuses the organisation if one is already there. Safe to run
 * against a live database.
 *
 * Values come from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD when set (for
 * CI), otherwise it prompts. The password prompt is masked so the secret does
 * not land in shell history or scrollback.
 */
const db = createSeedClient();

async function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  // readline writes each keystroke back to the terminal; replacing the writer
  // after the prompt is printed hides the password without hiding the label.
  const internal = rl as unknown as { _writeToOutput: (text: string) => void };

  const answer = rl.question(question);
  internal._writeToOutput = () => {};

  try {
    return await answer;
  } finally {
    rl.close();
    stdout.write("\n");
  }
}

async function ask(question: string, fallback?: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(fallback ? `${question} [${fallback}] ` : `${question} `);
    return answer.trim() || fallback || "";
  } finally {
    rl.close();
  }
}

async function main() {
  console.log("\nVionex Projects — criar administrador\n");

  const name = process.env.ADMIN_NAME ?? (await ask("Nome completo:"));
  if (name.length < 2) throw new Error("Informe um nome válido.");

  const email = (process.env.ADMIN_EMAIL ?? (await ask("E-mail:"))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new Error(
      `Já existe um usuário com o e-mail ${email}. Este script não sobrescreve contas.`,
    );
  }

  const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Senha (mín. 12 caracteres):"));
  if (password.length < 12) {
    throw new Error("A senha do administrador deve ter ao menos 12 caracteres.");
  }

  const organizationName = process.env.ORGANIZATION_NAME ?? "Vionex";
  const organization =
    (await db.organization.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await db.organization.create({
      data: {
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
    }));

  const user = await db.user.create({
    data: {
      organizationId: organization.id,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
      jobTitle: process.env.ADMIN_JOB_TITLE ?? null,
      language: "PT_BR",
      status: "ACTIVE",
    },
    select: { id: true, name: true, email: true },
  });

  await db.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: user.id,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      metadata: { role: "ADMIN", via: "create-admin script" },
    },
  });

  console.log(
    [
      "",
      "✓ Administrador criado.",
      `  Organização ... ${organization.name}`,
      `  Nome .......... ${user.name}`,
      `  E-mail ........ ${user.email}`,
      "",
      "  Faça login e, a partir de Equipe e Fornecedores, crie os demais acessos.",
      "",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
