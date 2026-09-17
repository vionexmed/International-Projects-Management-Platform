import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver, StoredMetadata, StoredObject } from "@/lib/storage/types";

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

    /**
     * A local directory has no URL a browser can PUT to, so this driver
     * declines and the caller falls back to sending the file through the
     * server. That path works fine here — the size limit that makes direct
     * upload necessary belongs to the deployment platform, not to a laptop.
     */
    async getStream(key) {
      const { createReadStream } = await import("node:fs");
      const { Readable } = await import("node:stream");
      const target = resolveKey(key);

      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(await fs.readFile(`${target}.meta`, "utf8")) as {
          contentType?: string;
        };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // Best-effort, as in `get`.
      }

      return {
        body: Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>,
        contentType,
      };
    },

    async presignPut() {
      return null;
    },

    async head(key): Promise<StoredMetadata | null> {
      try {
        const target = resolveKey(key);
        const stat = await fs.stat(target);
        let contentType = "application/octet-stream";
        try {
          const meta = JSON.parse(await fs.readFile(`${target}.meta`, "utf8")) as {
            contentType?: string;
          };
          if (meta.contentType) contentType = meta.contentType;
        } catch {
          // Best-effort, as in `get`.
        }
        return { size: stat.size, contentType };
      } catch {
        return null;
      }
    },
  };
}
