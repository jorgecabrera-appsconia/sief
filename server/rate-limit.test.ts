import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimitMiddleware } from "./rate-limit";

describe("createRateLimitMiddleware", () => {
  it("blocks requests after the shared limit is exceeded", async () => {
    let count = 0;
    const app = express();
    app.use(
      createRateLimitMiddleware({
        scope: "login",
        limit: 2,
        windowMs: 60_000,
        consume: async () => ++count,
      }),
    );
    app.post("/login", (_req, res) => res.json({ ok: true }));

    const first = await request(app).post("/login");
    const second = await request(app).post("/login");
    const third = await request(app).post("/login");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers["retry-after"]).toBeDefined();
  });

  it("fails closed when the shared limiter is unavailable", async () => {
    const app = express();
    app.use(
      createRateLimitMiddleware({
        scope: "registration",
        limit: 10,
        windowMs: 60_000,
        consume: async () => {
          throw new Error("database unavailable");
        },
      }),
    );
    app.post("/registration", (_req, res) => res.json({ ok: true }));

    const response = await request(app).post("/registration");

    expect(response.status).toBe(503);
  });
});
