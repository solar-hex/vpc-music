import "dotenv/config";

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001", 10),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5176",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5176",
  PDF_CO_API_KEY: process.env.PDF_CO_API_KEY || "",

  // Mailgun HTTP API
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || "",
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || process.env.MAILGUN_SMTP_PASS || "",
  MAILGUN_API_BASE_URL: process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net",
  EMAIL_FROM: process.env.EMAIL_FROM || "VPC Music <noreply@vpcmusic.com>",

  // OAuth2 — Google
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:5176/api/auth/google/callback",
};
