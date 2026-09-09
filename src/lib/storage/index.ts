import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { createLocalDriver } from "@/lib/storage/local";
import { createS3Driver } from "@/lib/storage/s3";
import type { StorageDriver } from "@/lib/storage/types";

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;

  if (env.STORAGE_DRIVER === "s3") {
    if (!env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY || !env.STORAGE_BUCKET) {
      throw new Error("STORAGE_DRIVER=s3 requires access key, secret key and bucket.");
    }
    driver = createS3Driver({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
      bucket: env.STORAGE_BUCKET,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    });
  } else {
    driver = createLocalDriver(env.STORAGE_LOCAL_DIR);
  }

  return driver;
}

/**
 * Storage keys are namespaced by organisation and project and end in a random
 * segment, so a key can never be guessed from a document name.
 */
export function buildStorageKey(input: {
  organizationId: string;
  projectId: string;
  fileName: string;
}) {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `${input.organizationId}/${input.projectId}/${randomUUID()}-${safeName}`;
}

export type { StorageDriver } from "@/lib/storage/types";
