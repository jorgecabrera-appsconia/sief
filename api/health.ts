import type { Request, Response } from "express";

export default function handler(_request: Request, response: Response) {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const sessionSecretConfigured = Boolean(
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
  );

  return response.status(databaseConfigured && sessionSecretConfigured ? 200 : 503).json({
    status: databaseConfigured && sessionSecretConfigured ? "ready" : "configuration_required",
    databaseConfigured,
    sessionSecretConfigured,
  });
}
