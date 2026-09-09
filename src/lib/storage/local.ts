import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver, StoredObject } from "@/lib/storage/types";

/**
 * Development driver. Files live under STORAGE_LOCAL_DIR, outside `public/`,
 * so they can only be read through the authenticated download route.
 */
export function createLocalDriver(rootDir: string): StorageDriver {
  // Turbopack cannot statically analyse this path and would otherwise trace
  // the entire project into the bundle. The local driver is development-only.
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), rootDir);

  /** Refuses any key that would escape the storage root. */
  function resolveKey(key: string) {
    const target = path.resolve(root, key);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error("Invalid storage key.");
    }
    return target;
  }

  return {
    name: "local",

    async put(key, body, contentType) {
      const target = resolveKey(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body);
      await fs.writeFile(`${target}.meta`, JSON.stringify({ contentType }), "utf8");
    },

    async get(key): Promise<StoredObject> {
      const target = resolveKey(key);
      const body = await fs.readFile(target);
      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(await fs.readFile(`${target}.meta`, "utf8")) as {
          contentType?: string;
        };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // Metadata is best-effort; fall back to a generic content type.
      }
      return { body, contentType };
    },

    async delete(key) {
      const target = resolveKey(key);
      await fs.rm(target, { force: true });
      await fs.rm(`${target}.meta`, { force: true });
    },
  };
}
