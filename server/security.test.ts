import { describe, expect, it } from "vitest";
import {
  evaluatePassword,
  hashPassword,
  isAllowedMutationOrigin,
  toPublicTeacherStudent,
} from "./security";

describe("evaluatePassword", () => {
  it("creates a bcrypt hash with cost 12", async () => {
    const result = await hashPassword("new-password");

    expect(result).toMatch(/^\$2[aby]\$12\$/);
    expect(result).not.toContain("new-password");
  });

  it("accepts a bcrypt password without requesting an upgrade", async () => {
    const stored =
      "$2b$12$VB69ElgQlJK6zTd2k0/neeh3HSV3Fii72zKEjAvdMdhIyHJkRdEZS";

    const result = await evaluatePassword("temporary-password", stored);

    expect(result).toEqual({ valid: true });
  });

  it("accepts a matching legacy password and returns a bcrypt replacement", async () => {
    const result = await evaluatePassword(
      "legacy-temporary-password",
      "legacy-temporary-password",
    );

    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("expected a valid legacy password");
    expect(result.upgradedHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("rejects a wrong password", async () => {
    const result = await evaluatePassword("wrong", "legacy-password");

    expect(result).toEqual({ valid: false });
  });
});

describe("toPublicTeacherStudent", () => {
  it("keeps only the public name and exam condition", () => {
    const result = toPublicTeacherStudent({
      firstName: "Ana",
      lastName: "Pérez",
      condition: "regular",
      dni: "12345678",
      phone: "3804000000",
      email: "ana@example.com",
    });

    expect(result).toEqual({
      firstName: "Ana",
      lastName: "Pérez",
      condition: "regular",
    });
    expect(result).not.toHaveProperty("dni");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("email");
  });
});

describe("isAllowedMutationOrigin", () => {
  it("accepts same-origin browser requests", () => {
    expect(
      isAllowedMutationOrigin(
        "https://sief.vercel.app",
        "sief.vercel.app",
        "https",
      ),
    ).toBe(true);
  });

  it("rejects cross-origin browser requests", () => {
    expect(
      isAllowedMutationOrigin(
        "https://attacker.example",
        "sief.vercel.app",
        "https",
      ),
    ).toBe(false);
  });

  it("allows non-browser requests without an Origin header", () => {
    expect(isAllowedMutationOrigin(undefined, "sief.vercel.app", "https")).toBe(
      true,
    );
  });
});
