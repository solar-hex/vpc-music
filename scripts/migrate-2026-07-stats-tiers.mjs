#!/usr/bin/env node
/**
 * Migration: sharing tiers, instrument parts, usage statistics, annotations.
 * Idempotent — safe to re-run. Covers every schema change since e1c6771:
 *
 *   1. song_tier enum + songs.tier column        (personal | organization | global)
 *   2. song_instrument_parts table                (per-musician layers)
 *   3. song_usages.setlist_id + source columns    (statistics linkage)
 *      + backfill: event-completed rows get their event's setlist + source;
 *        "Setlist: …" note rows get source='setlist_complete'
 *   4. song_annotations table                     (ink/highlight overlays)
 *   5. share_tokens setlist support               (nullable song_id + setlist_id
 *      + exactly-one-target check)
 *
 * Usage:
 *   node scripts/migrate-2026-07-stats-tiers.mjs           (uses apps/api/.env)
 *   node scripts/migrate-2026-07-stats-tiers.mjs stg|prd
 */

import { createRequire } from "node:module";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(__dirname, "../apps/api");

const require = createRequire(resolve(apiDir, "package.json"));
const pg = require("pg");

const envAliases = {
  dev: "development", development: "development",
  stg: "staging", stage: "staging", staging: "staging",
  prd: "production", prod: "production", production: "production",
};

const rawEnv = process.argv[2];
const env = rawEnv ? (envAliases[rawEnv.toLowerCase()] ?? rawEnv) : undefined;
const envFile = env ? `.env.${env}` : ".env";

config({ path: resolve(apiDir, envFile) });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // ── 1. song_tier enum + songs.tier ──────────────────────────
    console.log("1. song_tier enum + songs.tier column…");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "song_tier" AS ENUM ('personal', 'organization', 'global');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      ALTER TABLE "songs"
        ADD COLUMN IF NOT EXISTS "tier" "song_tier" DEFAULT 'organization' NOT NULL;
    `);

    // ── 2. song_instrument_parts ─────────────────────────────────
    console.log("2. song_instrument_parts table…");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "song_instrument_parts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "song_id" uuid NOT NULL REFERENCES "songs"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "icon" text,
        "color" text,
        "content" text,
        "abc_notation" text,
        "tier" "song_tier" DEFAULT 'personal' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "song_instrument_parts_song_idx" ON "song_instrument_parts" ("song_id");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "song_instrument_parts_user_idx" ON "song_instrument_parts" ("user_id");`);

    // ── 3. song_usages statistics linkage ────────────────────────
    console.log("3. song_usages.setlist_id + source…");
    await client.query(`
      ALTER TABLE "song_usages"
        ADD COLUMN IF NOT EXISTS "setlist_id" uuid REFERENCES "setlists"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;
    `);

    console.log("   backfilling event-completed usages…");
    const eventBackfill = await client.query(`
      UPDATE "song_usages" su
      SET "setlist_id" = e."setlist_id", "source" = 'event_complete'
      FROM "events" e
      WHERE su."event_id" = e."id" AND su."source" = 'manual';
    `);
    console.log(`   → ${eventBackfill.rowCount} rows linked to events`);

    console.log("   tagging setlist-completed usages…");
    const setlistBackfill = await client.query(`
      UPDATE "song_usages"
      SET "source" = 'setlist_complete'
      WHERE "source" = 'manual' AND "notes" LIKE 'Setlist: %';
    `);
    console.log(`   → ${setlistBackfill.rowCount} rows tagged setlist_complete`);

    // ── 4. song_annotations (ink overlays) ───────────────────────
    console.log("4. song_annotations table…");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "song_annotations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "song_id" uuid NOT NULL REFERENCES "songs"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "data" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "song_annotation_unique" ON "song_annotations" ("song_id", "user_id");`);

    // ── 5. share_tokens: setlist share links ─────────────────────
    console.log("5. share_tokens setlist support…");
    await client.query(`ALTER TABLE "share_tokens" ALTER COLUMN "song_id" DROP NOT NULL;`);
    await client.query(`
      ALTER TABLE "share_tokens"
        ADD COLUMN IF NOT EXISTS "setlist_id" uuid REFERENCES "setlists"("id") ON DELETE CASCADE;
    `);
    await client.query(`ALTER TABLE "share_tokens" DROP CONSTRAINT IF EXISTS "share_tokens_target_check";`);
    await client.query(`
      ALTER TABLE "share_tokens"
        ADD CONSTRAINT "share_tokens_target_check" CHECK (("song_id" IS NOT NULL) <> ("setlist_id" IS NOT NULL));
    `);

    console.log("\nMigration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
