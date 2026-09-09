#!/usr/bin/env node
/**
 * Local PostgreSQL for development.
 *
 * Runs a real PostgreSQL cluster from the binaries shipped by the
 * `embedded-postgres` package, so the project needs no system-wide Postgres,
 * no Docker and no root. Data lives in `.postgres/` and is gitignored.
 *
 *   node scripts/local-db.mjs start | stop | status | reset
 *
 * In any environment that already provides PostgreSQL (CI, staging,
 * production), ignore this script entirely and point DATABASE_URL at it.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BIN = path.join(ROOT, "node_modules/@embedded-postgres/darwin-arm64/native/bin");
const DATA_DIR = path.join(ROOT, ".postgres/data");
const LOG_FILE = path.join(ROOT, ".postgres/postgres.log");
const PWFILE = path.join(ROOT, ".postgres/.pwfile");
/**
 * The unix socket lives outside the project: a project path containing spaces
 * would otherwise be word-split when handed to the postgres process.
 */
const SOCKET_DIR = path.join(os.tmpdir(), "vionex-pg");

const PORT = process.env.LOCAL_DB_PORT ?? "5433";
const USER = process.env.LOCAL_DB_USER ?? "vionex";
const PASSWORD = process.env.LOCAL_DB_PASSWORD ?? "vionex_dev_password";
const DATABASE = process.env.LOCAL_DB_NAME ?? "vionex_projects";

function bin(name) {
  const file = path.join(BIN, name);
  if (!existsSync(file)) {
    console.error(
      `PostgreSQL binaries not found at ${BIN}.\n` +
        `Run \`npm install\` first, or point DATABASE_URL at your own PostgreSQL server.`,
    );
    process.exit(1);
  }
  return file;
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: "utf8",
    ...options,
    env: { ...process.env, PGPASSWORD: PASSWORD, ...(options.env ?? {}) },
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function isRunning() {
  return run(bin("pg_ctl"), ["status", "-D", DATA_DIR]).ok;
}

function init() {
  if (existsSync(path.join(DATA_DIR, "PG_VERSION"))) return;

  console.log("→ Inicializando cluster PostgreSQL local…");
  mkdirSync(path.dirname(PWFILE), { recursive: true });
  writeFileSync(PWFILE, PASSWORD, { mode: 0o600 });

  const result = run(bin("initdb"), [
    "-D", DATA_DIR,
    "-U", USER,
    `--pwfile=${PWFILE}`,
    "--auth=scram-sha-256",
    "--encoding=UTF8",
    "--locale=C",
  ]);

  rmSync(PWFILE, { force: true });

  if (!result.ok) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
}

async function start() {
  if (!/^[A-Za-z0-9_]+$/.test(DATABASE)) {
    console.error(`Nome de database inválido: ${DATABASE}`);
    process.exit(1);
  }
  init();

  if (isRunning()) {
    await ensureDatabase();
    console.log(`✓ PostgreSQL já está rodando na porta ${PORT}.`);
    return;
  }

  console.log("→ Iniciando PostgreSQL…");
  mkdirSync(SOCKET_DIR, { recursive: true });
  const result = run(bin("pg_ctl"), [
    "start",
    "-D", DATA_DIR,
    "-l", LOG_FILE,
    "-w", "-t", "30",
    "-o", `-p ${PORT} -k ${SOCKET_DIR} -c listen_addresses=127.0.0.1`,
  ]);

  if (!result.ok) {
    console.error(result.stderr || result.stdout);
    console.error(`Verifique o log em ${LOG_FILE}`);
    process.exit(1);
  }

  await ensureDatabase();
  console.log(`✓ PostgreSQL rodando em localhost:${PORT} (database "${DATABASE}").`);
}

/**
 * The embedded distribution ships only the server binaries (no psql), so the
 * database is created through the `pg` client the app already depends on.
 */
async function ensureDatabase() {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: Number(PORT),
    user: USER,
    password: PASSWORD,
    database: "postgres",
  });

  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      DATABASE,
    ]);
    if (rowCount === 0) {
      // Identifier cannot be parameterised; DATABASE is validated below.
      await client.query(`CREATE DATABASE "${DATABASE}"`);
      console.log(`→ Database "${DATABASE}" criada.`);
    }
  } finally {
    await client.end();
  }
}

function stop() {
  if (!isRunning()) {
    console.log("PostgreSQL não está rodando.");
    return;
  }
  const result = run(bin("pg_ctl"), ["stop", "-D", DATA_DIR, "-m", "fast", "-w"]);
  console.log(result.ok ? "✓ PostgreSQL parado." : result.stderr);
}

function status() {
  console.log(isRunning() ? `✓ Rodando na porta ${PORT}.` : "✗ Parado.");
}

function reset() {
  if (isRunning()) stop();
  rmSync(path.join(ROOT, ".postgres"), { recursive: true, force: true });
  console.log("✓ Cluster local removido.");
}

const command = process.argv[2] ?? "start";
const commands = { start, stop, status, reset };

if (!commands[command]) {
  console.error(`Comando desconhecido: ${command}\nUse: start | stop | status | reset`);
  process.exit(1);
}

await commands[command]();
