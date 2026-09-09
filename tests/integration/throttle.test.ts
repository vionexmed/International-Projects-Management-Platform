import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  checkLoginThrottle,
  clearLoginThrottle,
  recordFailedLogin,
} from "@/server/auth/throttle";

/**
 * The throttle is the only thing standing between the login form and
 * unlimited credential stuffing, so its limits are pinned by tests rather
 * than trusted.
 */
const EMAIL = "throttle-test@vionex.med.br";
const IP = "203.0.113.55";
const OTHER_IP = "198.51.100.7";

async function wipe() {
  await db.loginAttempt.deleteMany({
    where: { key: { in: [`email:${EMAIL}`, `ip:${IP}`, `ip:${OTHER_IP}`] } },
  });
}

describe("login throttle", () => {
  beforeEach(wipe);
  afterEach(wipe);

  it("allows the first attempt", async () => {
    const verdict = await checkLoginThrottle(EMAIL, IP);
    expect(verdict.blocked).toBe(false);
  });

  it("blocks the e-mail after 8 failures", async () => {
    for (let attempt = 0; attempt < 7; attempt += 1) {
      await recordFailedLogin(EMAIL, IP);
      expect((await checkLoginThrottle(EMAIL, IP)).blocked).toBe(false);
    }

    await recordFailedLogin(EMAIL, IP);
    const verdict = await checkLoginThrottle(EMAIL, IP);

    expect(verdict.blocked).toBe(true);
    expect(verdict.retryAfterMinutes).toBe(10);
  });

  it("keeps blocking the e-mail even from a different address", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await recordFailedLogin(EMAIL, IP);
    }

    // Rotating the source address must not reset an account-level lockout.
    expect((await checkLoginThrottle(EMAIL, OTHER_IP)).blocked).toBe(true);
  });

  it("does not block an untouched e-mail from the same address", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await recordFailedLogin(EMAIL, IP);
    }

    // 8 hits is over the e-mail limit but under the per-IP limit of 20.
    const other = await checkLoginThrottle("someone-else@vionex.med.br", IP);
    expect(other.blocked).toBe(false);
  });

  it("blocks the address once it sprays past the IP limit", async () => {
    // Spread failures across many accounts from one address.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await recordFailedLogin(`victim-${attempt}@vionex.med.br`, IP);
    }

    try {
      const verdict = await checkLoginThrottle("fresh-account@vionex.med.br", IP);
      expect(verdict.blocked).toBe(true);
    } finally {
      await db.loginAttempt.deleteMany({
        where: { key: { startsWith: "email:victim-" } },
      });
    }
  });

  it("clears the e-mail's counter after a successful sign-in", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await recordFailedLogin(EMAIL, IP);
    }
    expect((await checkLoginThrottle(EMAIL, IP)).blocked).toBe(true);

    await clearLoginThrottle(EMAIL);
    expect((await checkLoginThrottle(EMAIL, IP)).blocked).toBe(false);
  });

  it("ignores attempts older than the window", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await recordFailedLogin(EMAIL, IP);
    }
    expect((await checkLoginThrottle(EMAIL, IP)).blocked).toBe(true);

    // Age the rows past the 10-minute window.
    await db.loginAttempt.updateMany({
      where: { key: `email:${EMAIL}` },
      data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) },
    });

    expect((await checkLoginThrottle(EMAIL, IP)).blocked).toBe(false);
  });

  it("still works when the client address is unknown", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await recordFailedLogin(EMAIL, null);
    }

    expect((await checkLoginThrottle(EMAIL, null)).blocked).toBe(true);
  });
});
