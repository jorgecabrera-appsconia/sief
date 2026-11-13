import type { Express, Request, Response } from "express";
import { restoreVercelApiUrl } from "../server/vercel-request";

let appPromise: Promise<Express> | undefined;

function loadApp(): Promise<Express> {
  appPromise ??= import("../server/app").then(({ createApp }) => createApp());
  return appPromise;
}

export default async function handler(request: Request, response: Response) {
  const missingConfiguration: string[] = [];
  if (!process.env.DATABASE_URL) missingConfiguration.push("DATABASE_URL");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    missingConfiguration.push("SESSION_SECRET");
  }

  if (missingConfiguration.length > 0) {
    return response.status(500).json({
      error: "Server configuration is incomplete",
      code: "MISSING_ENVIRONMENT_VARIABLES",
      missing: missingConfiguration,
    });
  }

  request.url = restoreVercelApiUrl(request.url);

  try {
    const app = await loadApp();
    return app(request, response);
  } catch (error) {
    console.error(
      "API initialization failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response.status(500).json({
      error: "Server initialization failed",
      code: "API_INITIALIZATION_FAILED",
    });
  }
}
