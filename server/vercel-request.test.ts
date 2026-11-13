import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { restoreVercelApiUrl } from "./vercel-request";

describe("Vercel API routing", () => {
  it("restores the Express API path and preserves public query parameters", () => {
    expect(
      restoreVercelApiUrl(
        "/api/handler?examScheduleId=42&path=public%2Fteacher-portal",
      ),
    ).toBe("/api/public/teacher-portal?examScheduleId=42");
  });

  it("accepts repeated path parameters", () => {
    expect(
      restoreVercelApiUrl("/api/handler?path=auth&path=login"),
    ).toBe("/api/auth/login");
  });

  it("keeps direct requests unchanged", () => {
    expect(restoreVercelApiUrl("/api/auth/me")).toBe("/api/auth/me");
  });

  it("keeps API traffic out of the SPA fallback", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    );

    expect(config.rewrites).toEqual([
      { source: "/api/:path*", destination: "/api/handler" },
      { source: "/((?!api/).*)", destination: "/index.html" },
    ]);
  });
});
