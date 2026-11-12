import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
  consume: (key: string, expiresAt: Date) => Promise<number>;
  now?: () => number;
}

function hashClientAddress(address: string): string {
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const now = options.now?.() ?? Date.now();
    const bucketStart = Math.floor(now / options.windowMs) * options.windowMs;
    const expiresAt = new Date(bucketStart + options.windowMs);
    const client = hashClientAddress(req.ip || req.socket.remoteAddress || "unknown");
    const key = `${options.scope}:${client}:${bucketStart}`;

    try {
      const count = await options.consume(key, expiresAt);
      const remaining = Math.max(0, options.limit - count);
      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(Math.ceil(expiresAt.getTime() / 1000)));
      if (count > options.limit) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))),
        );
        return res.status(429).json({ message: "Demasiados intentos. Intente más tarde." });
      }
      next();
    } catch (error) {
      console.error("Shared rate limiter unavailable", error);
      res.status(503).json({ message: "Servicio temporalmente no disponible" });
    }
  };
}
