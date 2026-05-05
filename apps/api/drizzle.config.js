import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env" });

function isLocalHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function getSslMode(host, searchParams) {
  if (isLocalHost(host)) {
    return false;
  }

  const sslMode =
    searchParams?.get("sslmode") ?? process.env.DB_SSLMODE ?? process.env.PGSSLMODE;

  if (!sslMode || sslMode === "disable") {
    return undefined;
  }

  return sslMode;
}

function getDbCredentials() {
  if (process.env.DATABASE_URL) {
    const parsed = new URL(process.env.DATABASE_URL);
    const host = parsed.hostname || "localhost";
    const ssl = getSslMode(host, parsed.searchParams);

    return {
      host,
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
      ...(ssl === undefined ? {} : { ssl }),
    };
  }

  const host = process.env.DB_HOST || "localhost";
  const ssl = getSslMode(host);

  return {
    host,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "vpc-music",
    ...(ssl === undefined ? {} : { ssl }),
  };
}

export default defineConfig({
  schema: "./src/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: getDbCredentials(),
  schemaFilter: ["public"],
});
