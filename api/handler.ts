import type { Request, Response } from "express";
import { createApp } from "../server/app";
import { restoreVercelApiUrl } from "../server/vercel-request";

const app = createApp();

export default function handler(request: Request, response: Response) {
  request.url = restoreVercelApiUrl(request.url);
  return app(request, response);
}
