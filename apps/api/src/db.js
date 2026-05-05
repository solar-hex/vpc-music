import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./config/env.js";

function isLocalHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function getSslConfig(sslMode, host) {
  if (!sslMode || sslMode === "disable" || isLocalHost(host)) {
    return undefined;
  }

  if (sslMode === "verify-full") {
    return {};
  }

  return { rejectUnauthorized: false };
}

function getPoolConfig() {
  if (!env.DATABASE_URL) {
    return {};
  }

  const parsed = new URL(env.DATABASE_URL);
  const sslMode = parsed.searchParams.get("sslmode") ?? process.env.DB_SSLMODE ?? process.env.PGSSLMODE;
  const ssl = getSslConfig(sslMode, parsed.hostname);

  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    ...(ssl === undefined ? {} : { ssl }),
  };
}

const pool = new pg.Pool({
  ...getPoolConfig(),
});

export const db = drizzle(pool);
export { pool };
