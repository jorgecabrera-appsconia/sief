import session from "express-session";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { IStorage } from "./storage";
import { createApp } from "./app";

function createStorage(overrides: Partial<IStorage> = {}): IStorage {
  const defaults = new Proxy(
    {},
    {
      get: (target, property, receiver) =>
        Reflect.has(target, property)
          ? Reflect.get(target, property, receiver)
          : async () => [],
    },
  ) as IStorage;

  return Object.assign(defaults, {
    isMaintenanceModeActive: async () => false,
    validateAdminCredentials: async () => null,
    getAllStudents: async () => [],
    consumeRateLimit: async () => 1,
    ...overrides,
  });
}

function buildTestApp(storage: IStorage) {
  return createApp({
    storage,
    sessionStore: new session.MemoryStore(),
    sessionSecret: "test-session-secret-at-least-32-characters",
    isProduction: false,
  });
}

describe("createApp", () => {
  it("refuses to start production without a strong session secret", () => {
    expect(() =>
      createApp({
        storage: createStorage(),
        sessionStore: new session.MemoryStore(),
        sessionSecret: "short",
        isProduction: true,
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("sets security headers and exposes only the maintenance status publicly", async () => {
    const app = buildTestApp(createStorage());

    const maintenance = await request(app).get("/api/maintenance/status");
    const students = await request(app).get("/api/students");

    expect(maintenance.status).toBe(200);
    expect(maintenance.headers["x-content-type-options"]).toBe("nosniff");
    expect(students.status).toBe(401);
  });

  it("rejects a state-changing request from a different origin", async () => {
    const app = buildTestApp(createStorage());

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Host", "sief.vercel.app")
      .set("Origin", "https://attacker.example");

    expect(response.status).toBe(403);
  });

  it("persists an authenticated admin session", async () => {
    const storage = createStorage({
      validateAdminCredentials: async (username, password) =>
        username === "admin" && password === "valid-password"
          ? {
              id: 1,
              username: "admin",
              password: "stored-value-never-returned",
              role: "admin",
              createdAt: new Date(),
            }
          : null,
    });
    const agent = request.agent(buildTestApp(storage));

    const login = await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "valid-password" });
    const students = await agent.get("/api/students");

    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({ id: 1, username: "admin", role: "admin" });
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(login.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(students.status).toBe(200);
  });

  it("allows authenticated cloning even when the public read limit is exhausted", async () => {
    const cloneExamCall = vi.fn(async () => ({
      examCall: { id: 2, name: "Copia", description: null, startDate: "2027-01-01", endDate: "2027-01-02", isActive: false, createdAt: new Date() },
      clonedSchedules: 150,
    }));
    const storage = createStorage({
      consumeRateLimit: async (key) => key.startsWith("public-read:") ? 301 : 1,
      validateAdminCredentials: async () => ({ id: 1, username: "admin", password: "hash", role: "admin", createdAt: new Date() }),
      cloneExamCall,
    });
    const agent = request.agent(buildTestApp(storage));

    expect((await agent.get("/api/exam-calls")).status).toBe(429);
    expect((await agent.post("/api/auth/login").send({ username: "admin", password: "valid-password" })).status).toBe(200);
    const response = await agent.post("/api/exam-calls/1/clone").send({ name: "Copia", startDate: "2027-01-01", endDate: "2027-01-02" });
    expect(response.status).toBe(201);
    expect(response.body.clonedSchedules).toBe(150);
    expect(cloneExamCall).toHaveBeenCalledOnce();
    expect((await agent.get("/api/exam-calls")).status).toBe(200);
  });

  it("destroys the authenticated session on logout", async () => {
    const storage = createStorage({
      validateAdminCredentials: async () =>
        ({
          id: 1,
          username: "admin",
          password: "stored-value-never-returned",
          role: "admin",
          createdAt: new Date(),
        }) as never,
    });
    const agent = request.agent(buildTestApp(storage));

    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "valid-password" });
    const logout = await agent.post("/api/auth/logout");
    const students = await agent.get("/api/students");

    expect(logout.status).toBe(200);
    expect(students.status).toBe(401);
  });

  it("accepts a public registration with an allowlisted payload", async () => {
    const createPublicRegistration = vi.fn(async (input) => ({
      student: { id: 12, ...input.student, createdAt: new Date() },
      inscription: {
        id: 34,
        studentId: 12,
        examScheduleIds: input.examScheduleIds,
        examConditions: input.examConditions,
        status: "pending",
        confirmedBy: null,
        confirmedAt: null,
        permissionNumber: null,
        createdAt: new Date(),
      },
    }));
    const storage = createStorage() as IStorage & {
      createPublicRegistration: typeof createPublicRegistration;
    };
    storage.createPublicRegistration = createPublicRegistration;
    const app = buildTestApp(storage);

    const response = await request(app)
      .post("/api/public/registrations")
      .send({
        student: {
          firstName: "Ana",
          lastName: "Pérez",
          dni: "12345678",
          phone: "3804000000",
          email: "ana@example.com",
          profesorado: "Biología",
          turno: "siesta",
          year: 2,
          division: "A",
          yearEntered: 2025,
        },
        examScheduleIds: ["8"],
        examConditions: ["regular"],
        status: "confirmed",
        permissionNumber: 999,
      });

    expect(response.status).toBe(201);
    expect(createPublicRegistration).toHaveBeenCalledWith({
      student: expect.objectContaining({ dni: "12345678" }),
      examScheduleIds: ["8"],
      examConditions: ["regular"],
    });
    expect(createPublicRegistration.mock.calls[0][0]).not.toHaveProperty("status");
    expect(createPublicRegistration.mock.calls[0][0]).not.toHaveProperty(
      "permissionNumber",
    );
  });

  it("redacts personal data from the public teacher portal", async () => {
    const storage = createStorage({
      getActiveExamCall: async () => ({
        id: 3,
        name: "Noviembre",
        description: null,
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        isActive: true,
        createdAt: new Date(),
      }),
      getExamSchedule: async () =>
        ({
          id: 8,
          examCallId: 3,
          registrationOpen: true,
          subject: "Biología",
          examScheduleIds: [],
        }) as never,
      getInscriptionsByExamCallId: async () =>
        [
          {
            id: 5,
            studentId: 12,
            examScheduleIds: ["8"],
            examConditions: ["libre"],
            status: "confirmed",
            confirmedBy: "admin",
            confirmedAt: new Date(),
            permissionNumber: 10,
            createdAt: new Date(),
          },
        ],
      getStudent: async () =>
        ({
          id: 12,
          firstName: "Ana",
          lastName: "Pérez",
          dni: "12345678",
          phone: "3804000000",
          email: "ana@example.com",
        }) as never,
    });

    const response = await request(buildTestApp(storage)).get(
      "/api/public/teacher-portal?examScheduleId=8",
    );

    expect(response.status).toBe(200);
    expect(response.body.students).toEqual([
      { firstName: "Ana", lastName: "Pérez", condition: "libre" },
    ]);
    expect(JSON.stringify(response.body)).not.toContain("12345678");
    expect(JSON.stringify(response.body)).not.toContain("ana@example.com");
  });

  it.each([
    ["get", "/api/students/dni/12345678"],
    ["post", "/api/students"],
    ["patch", "/api/students/1"],
    ["post", "/api/exam-schedules"],
    ["put", "/api/exam-schedules/1"],
    ["patch", "/api/exam-schedules/1"],
    ["delete", "/api/exam-schedules/1"],
    ["post", "/api/inscriptions"],
    ["patch", "/api/inscriptions/1/status"],
    ["patch", "/api/inscriptions/1"],
    ["post", "/api/teachers"],
    ["post", "/api/exam-calls"],
    ["put", "/api/exam-calls/1"],
    ["patch", "/api/exam-calls/1/activate"],
    ["delete", "/api/exam-calls/1"],
    ["post", "/api/exam-calls/1/clone"],
  ] as const)("requires admin authentication for %s %s", async (method, path) => {
    const app = buildTestApp(createStorage());
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
  });

  it("returns a reduced public registration status", async () => {
    const storage = createStorage({
      getStudentByDni: async () =>
        ({
          id: 12,
          firstName: "Ana",
          lastName: "Pérez",
          dni: "12345678",
          phone: "3804000000",
          email: "ana@example.com",
          profesorado: "Biología",
          turno: "siesta",
        }) as never,
      getInscriptionsByStudent: async () => [
        {
          id: 5,
          studentId: 12,
          examScheduleIds: ["8"],
          examConditions: ["regular"],
          status: "confirmed",
          permissionNumber: 10,
          confirmedBy: "admin-secret",
          confirmedAt: new Date(),
          createdAt: new Date(),
        },
      ],
      getExamSchedule: async () =>
        ({ id: 8, examCallId: 3, subject: "Biología", date: "2026-11-20", time: "18:00" }) as never,
      getAllExamCalls: async () => [
        ({ id: 3, name: "Noviembre", startDate: "2026-11-01", endDate: "2026-11-30" }) as never,
      ],
    });

    const response = await request(buildTestApp(storage)).get(
      "/api/inscriptions/status/12345678",
    );

    expect(response.status).toBe(200);
    expect(response.body.student).toEqual({
      firstName: "Ana",
      lastName: "Pérez",
      dni: "12345678",
      profesorado: "Biología",
      turno: "siesta",
    });
    expect(response.body.inscriptions[0].inscription).not.toHaveProperty(
      "confirmedBy",
    );
    expect(JSON.stringify(response.body)).not.toContain("ana@example.com");
    expect(JSON.stringify(response.body)).not.toContain("3804000000");
  });
});
