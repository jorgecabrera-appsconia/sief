import type { Request, Response } from "express";
import { createApp } from "../server/app.js";
import { restoreVercelApiUrl } from "../server/vercel-request.js";

const app = createApp();

export default function handler(request: Request, response: Response) {
  request.url = restoreVercelApiUrl(request.url);
  return app(request, response);
}
