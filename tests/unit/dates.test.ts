import { describe, expect, it } from "vitest";
import { daysUntil, formatDate, startOfTodayUtc } from "@/lib/format";

/**
 * Deadlines are dates, not instants.
 *
 * A due date in this product means "the 20th", not "the 20th at midnight in
 * whichever city the server happens to run". It is stored at UTC midnight and
 * rendered with `timeZone: "UTC"`, so everything that decides whether it has
 * passed has to use the same reference.
 *
 * It did not. `daysUntil` compared *local* midnight against a UTC-midnight
 * date, so in any negative offset the deadline landed in yesterday: a task due
 * today showed "1 dia atrasado" to every Brazilian user, all day.
 */
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

function todayUtcIso() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
}

describe("deadline arithmetic", () => {
  it("calls a deadline due today zero days away, not overdue", () => {
    expect(daysUntil(dateOnly(todayUtcIso()))).toBe(0);
  });

  it("counts forward and backward in whole days", () => {
    const today = startOfTodayUtc().getTime();
    const day = 24 * 60 * 60 * 1000;

    expect(daysUntil(new Date(today + 3 * day))).toBe(3);
    expect(daysUntil(new Date(today - 5 * day))).toBe(-5);
  });

  it("agrees with the date the screen prints", () => {
    /**
     * The invariant that matters: whatever day `formatDate` shows is the day
     * `daysUntil` counts to. If these two disagree the interface contradicts
     * itself — "20 set · 1 dia atrasado" on the 20th.
     */
    const due = dateOnly(todayUtcIso());
    expect(formatDate(due, "pt-BR")).toBe(formatDate(startOfTodayUtc(), "pt-BR"));
    expect(daysUntil(due)).toBe(0);
  });

  it("returns null for a missing date rather than guessing", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
    expect(formatDate(null)).toBe("—");
  });

  it("starts the day at UTC midnight", () => {
    const start = startOfTodayUtc();
    expect(start.getUTCHours()).toBe(0);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
    expect(start.getUTCMilliseconds()).toBe(0);
  });
});
