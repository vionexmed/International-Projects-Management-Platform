import "dotenv/config";
import os from "node:os";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the test suite. Run `npm run db:start` first.");
}

// Uploads made by tests go to a scratch directory, never the project's store.
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = path.join(os.tmpdir(), "vionex-test-storage");
