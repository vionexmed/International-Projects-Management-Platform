import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = path.resolve(process.cwd(), "src/app");

function segments(dir: string): string[] {
  return readdirSync(dir).filter((entry) => statSync(path.join(dir, entry)).isDirectory());
}

function walk(dir: string, found: string[] = []): string[] {
  found.push(dir);
  for (const child of segments(dir)) walk(path.join(dir, child), found);
  return found;
}

/** A route group like `(index)` does not create a URL segment. */
const isGroup = (name: string) => name.startsWith("(") && name.endsWith(")");
const isDynamic = (name: string) => name.startsWith("[");

/**
 * A `loading.tsx` opens a Suspense boundary that flushes the shell before the
 * nested segment resolves — which commits HTTP 200 and makes a later
 * `notFound()` unable to set 404. That silently turns "supplier A cannot see
 * supplier B's project" from a clean 404 into a 200, so the placement of these
 * files is an invariant worth testing rather than remembering.
 *
 * Skeletons therefore live inside a route group (`(index)/loading.tsx`) that
 * covers only the list page, never its dynamic sibling.
 */
describe("route structure", () => {
  const dirs = walk(APP_DIR);

  it("never places loading.tsx in a segment that has a dynamic child", () => {
    const offenders: string[] = [];

    for (const dir of dirs) {
      const entries = readdirSync(dir);
      if (!entries.includes("loading.tsx")) continue;

      // Look for a dynamic route anywhere below, ignoring group boundaries.
      const hasDynamicDescendant = (current: string): boolean =>
        segments(current).some(
          (child) =>
            isDynamic(child) ||
            (isGroup(child) && hasDynamicDescendant(path.join(current, child))) ||
            hasDynamicDescendant(path.join(current, child)),
        );

      if (hasDynamicDescendant(dir)) {
        offenders.push(path.relative(APP_DIR, dir) || ".");
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps a loading skeleton on the list routes", () => {
    const withLoading = dirs
      .filter((dir) => readdirSync(dir).includes("loading.tsx"))
      .map((dir) => path.relative(APP_DIR, dir));

    // The heavy list screens should still show a skeleton while they load.
    expect(withLoading).toEqual(
      expect.arrayContaining([
        path.join("(internal)", "projects", "(index)"),
        path.join("(internal)", "tasks", "(index)"),
        path.join("(internal)", "suppliers", "(index)"),
        path.join("(internal)", "documents"),
        path.join("(internal)", "dashboard"),
      ]),
    );
  });

  it("gives both environments an error boundary", () => {
    const withError = dirs
      .filter((dir) => readdirSync(dir).includes("error.tsx"))
      .map((dir) => path.relative(APP_DIR, dir));

    // path.relative() yields "" for the app root itself.
    expect(withError).toEqual(
      expect.arrayContaining(["", "(internal)", path.join("(supplier)", "supplier")]),
    );
  });
});
