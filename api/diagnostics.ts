import type { Request, Response } from "express";

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  return error.message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database-url-redacted]")
    .slice(0, 300);
}

export default async function handler(_request: Request, response: Response) {
  const completed: string[] = [];

  try {
    await import("../shared/schema.js");
    completed.push("schema");
    await import("../server/security.js");
    completed.push("security");
    await import("../server/db.js");
    completed.push("database-module");
    await import("../server/storage.js");
    completed.push("storage");
    await import("../server/routes.js");
    completed.push("routes");
    const { createApp } = await import("../server/app.js");
    completed.push("app-module");
    createApp();
    completed.push("app-created");

    return response.status(200).json({ status: "ready", completed });
  } catch (error) {
    return response.status(500).json({
      status: "failed",
      completed,
      error: safeErrorMessage(error),
    });
  }
}
