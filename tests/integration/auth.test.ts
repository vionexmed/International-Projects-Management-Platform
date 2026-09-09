import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSessionToken, verifySessionToken } from "@/server/auth/session";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("vionex123");

    expect(hash).not.toBe("vionex123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("vionex123", hash)).toBe(true);
    expect(await verifyPassword("vionex124", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts each hash so identical passwords differ", async () => {
    const [first, second] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);
    expect(first).not.toBe(second);
  });
});

describe("session tokens", () => {
  const identity = { id: "user-1", organizationId: "org-1" };

  it("round-trips the identity claims", async () => {
    const { token } = await createSessionToken(identity, false);
    await expect(verifySessionToken(token)).resolves.toEqual({
      userId: "user-1",
      organizationId: "org-1",
    });
  });

  it("uses a longer lifetime when the user asks to be remembered", async () => {
    const short = await createSessionToken(identity, false);
    const remembered = await createSessionToken(identity, true);

    expect(short.maxAge).toBe(60 * 60 * 8);
    expect(remembered.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("rejects a tampered or malformed token", async () => {
    const { token } = await createSessionToken(identity, false);

    // Flip the last character of the signature.
    const tampered = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");

    await expect(verifySessionToken(tampered)).resolves.toBeNull();
    await expect(verifySessionToken("not-a-token")).resolves.toBeNull();
    await expect(verifySessionToken("")).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const foreign = await new SignJWT({ org: "org-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("vionex-projects")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("an-entirely-different-secret-value-32"));

    await expect(verifySessionToken(foreign)).resolves.toBeNull();
  });

  it("does not carry the role in the token", async () => {
    // Roles are re-read from the database on every request, so a downgraded
    // account cannot keep acting on an old token.
    const { token } = await createSessionToken(identity, false);
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("supplierId");
  });
});


describe("password rotation", () => {
  it("replaces the stored hash and invalidates the old password", async () => {
    const { createTestOrg, createUser, destroyOrg } = await import("../factories");
    const org = await createTestOrg("Rotation");

    try {
      const user = await createUser({ organizationId: org.id, role: "MANAGER" });
      const before = await db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      expect(await verifyPassword("test-password-123", before.passwordHash)).toBe(true);

      // What changePasswordAction performs once the current password checks out.
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword("a-brand-new-password") },
      });

      const after = await db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { passwordHash: true },
      });

      expect(after.passwordHash).not.toBe(before.passwordHash);
      expect(await verifyPassword("a-brand-new-password", after.passwordHash)).toBe(true);
      expect(await verifyPassword("test-password-123", after.passwordHash)).toBe(false);
    } finally {
      await destroyOrg(org.id);
    }
  });
});
