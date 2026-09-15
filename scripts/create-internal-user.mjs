#!/usr/bin/env node
/**
 * Creates one internal Vionex account, for the local development database.
 *
 * There is no self-registration in this product — accounts are created by an
 * administrator — so the first real account has to come from somewhere. This
 * is that somewhere, and it is deliberately small: it creates one user, prints
 * a randomly generated password once, and stops. The password is not stored
 * anywhere else and is meant to be changed on first sign-in.
 *
 *   npm run user:create -- "Nome Completo" email@vionex.med.br ADMIN
 */
import crypto from "node:crypto";
// `tsx` does not read .env on its own, and without DATABASE_URL this would
// quietly create the account inside the throwaway embedded database instead.
import "dotenv/config";

const [name, email, role = "ADMIN", jobTitle = null] = process.argv.slice(2);
if (!name || !email) {
  console.error('Uso: npm run user:create -- "Nome Completo" email@vionex.med.br [ROLE]');
  process.exit(1);
}

const { db } = await import("../src/server/db.ts");
const { hashPassword } = await import("../src/server/auth/password.ts");

const existing = await db.user.findUnique({
  where: { email },
  select: { id: true, name: true, role: true },
});
if (existing) {
  // Never silently overwrite an account, and never reveal or reset a password
  // as a side effect of a "create".
  console.error(`✗ Já existe uma conta com ${email} (${existing.name}, ${existing.role}).`);
  process.exit(1);
}

const organization = await db.organization.findFirstOrThrow({
  where: { slug: "vionex" },
  select: { id: true },
});

// Random rather than memorable: it is meant to be used once and replaced.
const password = crypto.randomBytes(9).toString("base64url");

const user = await db.user.create({
  data: {
    organizationId: organization.id,
    supplierId: null,
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    status: "ACTIVE",
    jobTitle,
  },
  select: { id: true, email: true, role: true },
});

console.log(`✓ ${user.email} · ${user.role}`);
console.log(`  senha provisória: ${password}`);
console.log("  Troque em Configurações → Alterar senha. Ela não fica guardada em lugar nenhum.");
await db.$disconnect();
