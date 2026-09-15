import "dotenv/config";

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001", 10),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
  // Sessions last months so a musician signs in once per device; the cookie
  // is renewed on use (see routes/auth.js) and dies with the token otherwise.
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "180d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5176",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5176",

  // Mailgun HTTP API
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || "",
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || process.env.MAILGUN_SMTP_PASS || "",
  MAILGUN_API_BASE_URL: process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net",
  EMAIL_FROM: process.env.EMAIL_FROM || "VPC Music <noreply@vpcmusic.com>",

  // Object storage (Wasabi, S3-compatible). S3_ROOT_PATH prefixes every key so
  // one bucket can hold several environments side by side.
  //
  // WASABI_* is the naming used across the other projects' infrastructure and
  // wins; S3_* is accepted as a fallback so either convention works.
  S3_ENABLED: (process.env.WASABI_ENABLED ?? "true").toLowerCase() !== "false",
  S3_ACCESS_KEY: process.env.WASABI_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || "",
  S3_SECRET_KEY: process.env.WASABI_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || "",
  S3_BUCKET: process.env.WASABI_BUCKET || process.env.S3_BUCKET || "",
  S3_REGION: process.env.WASABI_REGION || process.env.S3_REGION || "us-central-1",
  S3_ENDPOINT:
    process.env.WASABI_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    "https://s3.us-central-1.wasabisys.com",
  S3_ROOT_PATH: process.env.WASABI_ROOT_PATH || process.env.S3_ROOT_PATH || "v1/dev",

  // OAuth2 — Google
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3001/auth/google/callback",
};
