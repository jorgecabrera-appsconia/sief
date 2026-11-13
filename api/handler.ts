import type { Request, Response } from "express";
import { createApp } from "../server/app";

const app = createApp();

export default function handler(request: Request, response: Response) {
  const url = new URL(request.url, "http://localhost");
  const apiPath = url.searchParams.get("__sief_path");

  if (apiPath !== null) {
    url.searchParams.delete("__sief_path");
    const query = url.searchParams.toString();
    request.url = `/api/${apiPath}${query ? `?${query}` : ""}`;
  }

  return app(request, response);
}
