import { describe, expect, it } from "vitest";
import {
  canManageExamConfiguration,
  getVisibleAdminTabs,
} from "./admin-permissions";

describe("admin role permissions", () => {
  it("limits a bedel to inscriptions and read-only exam schedules", () => {
    expect(getVisibleAdminTabs("bedel")).toEqual(["inscriptions", "exams"]);
    expect(canManageExamConfiguration("bedel")).toBe(false);
  });

  it("keeps the existing administrator configuration access", () => {
    expect(getVisibleAdminTabs("admin")).toEqual([
      "inscriptions",
      "exams",
      "exam-calls",
      "subjects",
    ]);
    expect(canManageExamConfiguration("admin")).toBe(true);
  });

  it("keeps user management exclusive to superadministrators", () => {
    expect(getVisibleAdminTabs("superadmin")).toEqual([
      "inscriptions",
      "exams",
      "exam-calls",
      "subjects",
      "users",
    ]);
    expect(canManageExamConfiguration("superadmin")).toBe(true);
  });
});
