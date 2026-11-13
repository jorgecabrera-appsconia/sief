import session from "express-session";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { AdminUserManagementError, type IStorage } from "./storage";
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
    const admin = {
      id: 1,
      username: "admin",
      password: "stored-value-never-returned",
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const storage = createStorage({
      validateAdminCredentials: async (username, password) =>
        username === "admin" && password === "valid-password"
          ? admin
          : null,
      getAdminUserById: async () => admin,
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));

    const login = await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "valid-password" });
    const students = await agent.get("/api/students");

    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({
      id: 1,
      username: "admin",
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(login.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(students.status).toBe(200);
  });

  it("allows only a superadmin to list safe administrator records", async () => {
    const superadmin = {
      id: 7,
      username: "jcabrera",
      password: "stored-hash",
      role: "superadmin",
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      createdAt: new Date("2025-07-25T21:01:26.583Z"),
      updatedAt: new Date("2025-07-25T21:01:26.583Z"),
    };
    const storage = createStorage({
      validateAdminCredentials: async () => superadmin,
      getAdminUserById: async () => superadmin,
      listAdminUsers: async () => [superadmin],
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));

    await agent.post("/api/auth/login").send({ username: "jcabrera", password: "valid-password" });
    const response = await agent.get("/api/admin/users");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{
      id: 7,
      username: "jcabrera",
      role: "superadmin",
      isActive: true,
      mustChangePassword: false,
      createdAt: "2025-07-25T21:01:26.583Z",
      updatedAt: "2025-07-25T21:01:26.583Z",
    }]);
    expect(JSON.stringify(response.body)).not.toContain("stored-hash");
    expect(JSON.stringify(response.body)).not.toContain("sessionVersion");
  });

  it("rejects administrator user management by a regular admin", async () => {
    const admin = {
      id: 1,
      username: "bedeltm",
      password: "stored-hash",
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const storage = createStorage({
      validateAdminCredentials: async () => admin,
      getAdminUserById: async () => admin,
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));

    await agent.post("/api/auth/login").send({ username: "bedeltm", password: "valid-password" });
    const response = await agent.get("/api/admin/users");

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("allows a bedel to manage the complete inscriptions workflow", async () => {
    const now = new Date("2026-11-13T12:00:00.000Z");
    const bedel = {
      id: 1, username: "bedeltm", password: "stored-hash", role: "bedel",
      isActive: true, mustChangePassword: false, sessionVersion: 1,
      createdAt: now, updatedAt: now,
    };
    const student = {
      id: 10, firstName: "Ana", lastName: "Pérez", dni: "12345678",
      phone: "3804000000", email: "ana@example.com", profesorado: "Biología",
      turno: "siesta", year: 2, division: "A", yearEntered: 2025, createdAt: now,
    };
    const inscription = {
      id: 20, studentId: 10, examScheduleIds: ["30"], examConditions: ["regular"],
      status: "pending", confirmedBy: null, confirmedAt: null,
      permissionNumber: null, createdAt: now,
    };
    const examSchedule = {
      id: 30, examCallId: 4, subject: "Biología", year: 2,
      profesorado: "Biología", turno: "siesta", division: "A",
      date: "2026-11-20", time: "18:00", teacher: "Docente",
      presidente: "Presidente", vocal1: "Vocal 1", vocal2: "Vocal 2",
      vocalSuplente: "Suplente", period: "Noviembre 2026",
      registrationOpen: true, createdAt: now,
    };
    const storage = createStorage({
      validateAdminCredentials: async () => bedel,
      getAdminUserById: async () => bedel,
      getAllStudents: async () => [student],
      getAllInscriptions: async () => [inscription],
      getStudent: async () => student,
      getExamSchedule: async () => examSchedule,
      updateInscriptionStatus: async (_id, status) => ({ ...inscription, status }),
      getNextPermissionNumber: async () => 42,
      getInscriptionStatistics: async () => ({ total: 1 }),
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));

    await agent.post("/api/auth/login").send({ username: "bedeltm", password: "valid-password" });

    expect((await agent.get("/api/students")).status).toBe(200);
    expect((await agent.get("/api/inscriptions")).status).toBe(200);
    expect((await agent.patch("/api/inscriptions/20/status").send({ status: "confirmed" })).status).toBe(200);
    expect((await agent.get("/api/inscriptions/export")).status).toBe(200);
    expect((await agent.get("/api/statistics")).status).toBe(200);
    expect((await agent.get("/api/statistics/inscriptions")).status).toBe(200);
    expect((await agent.get("/api/permission-counter/next")).status).toBe(200);
  });

  it.each([
    ["post", "/api/exam-schedules"],
    ["put", "/api/exam-schedules/1"],
    ["patch", "/api/exam-schedules/1"],
    ["delete", "/api/exam-schedules/1"],
    ["post", "/api/teachers"],
    ["post", "/api/subjects"],
    ["patch", "/api/subjects/1"],
    ["delete", "/api/subjects/1"],
    ["post", "/api/exam-calls"],
    ["put", "/api/exam-calls/1"],
    ["patch", "/api/exam-calls/1/activate"],
    ["delete", "/api/exam-calls/1"],
    ["post", "/api/exam-calls/1/clone"],
    ["get", "/api/admin/users"],
    ["post", "/api/maintenance/toggle"],
  ] as const)("forbids a bedel from %s %s", async (method, path) => {
    const bedel = {
      id: 1, username: "bedeltm", password: "stored-hash", role: "bedel",
      isActive: true, mustChangePassword: false, sessionVersion: 1,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const storage = createStorage({
      validateAdminCredentials: async () => bedel,
      getAdminUserById: async () => bedel,
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));
    await agent.post("/api/auth/login").send({ username: "bedeltm", password: "valid-password" });

    const response = await agent[method](path).send({});

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ROLE_FORBIDDEN");
  });

  it("restricts a user to changing their password when a change is required", async () => {
    let mustChangePassword = true;
    let sessionVersion = 1;
    const currentUser = () => ({
      id: 1,
      username: "bedeltm",
      password: "stored-hash",
      role: "bedel",
      isActive: true,
      mustChangePassword,
      sessionVersion,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const storage = createStorage({
      validateAdminCredentials: async () => currentUser(),
      getAdminUserById: async () => currentUser(),
      changeAdminPassword: async () => {
        mustChangePassword = false;
        sessionVersion += 1;
        return currentUser();
      },
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));

    const login = await agent.post("/api/auth/login").send({ username: "bedeltm", password: "old-password" });
    expect(login.body.user.mustChangePassword).toBe(true);

    const blocked = await agent.get("/api/students");
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const changed = await agent.post("/api/auth/change-password").send({
      currentPassword: "old-password",
      newPassword: "new-password",
    });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect((await agent.get("/api/students")).status).toBe(200);
  });

  it("supports the complete superadmin user-management lifecycle", async () => {
    const now = new Date("2026-11-13T12:00:00.000Z");
    const superadmin = {
      id: 7, username: "jcabrera", password: "stored-hash", role: "superadmin",
      isActive: true, mustChangePassword: false, sessionVersion: 1,
      createdAt: now, updatedAt: now,
    };
    const managedUser = {
      id: 8, username: "nuevo.usuario", password: "another-stored-hash", role: "admin",
      isActive: true, mustChangePassword: true, sessionVersion: 1,
      createdAt: now, updatedAt: now,
    };
    const storage = createStorage({
      validateAdminCredentials: async () => superadmin,
      getAdminUserById: async () => superadmin,
      createManagedAdminUser: async (input) => ({ ...managedUser, ...input, password: "hashed-only" }),
      updateManagedAdminUser: async (_id, input) => ({ ...managedUser, ...input, password: "hashed-only", sessionVersion: 2 }),
      resetManagedAdminPassword: async (_id, input) => ({
        ...managedUser,
        password: "new-hash",
        mustChangePassword: input.mustChangePassword,
        sessionVersion: 2,
      }),
      deleteManagedAdminUser: async () => undefined,
      listAdminUserAudit: async () => ({
        total: 1,
        entries: [{
          id: 1,
          actorUserId: 7,
          actorUsername: "jcabrera",
          targetUserId: 8,
          targetUsername: "nuevo.usuario",
          action: "created",
          changes: { role: "admin" },
          createdAt: now,
        }],
      }),
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));
    await agent.post("/api/auth/login").send({ username: "jcabrera", password: "valid-password" });

    const created = await agent.post("/api/admin/users").send({
      username: "  Nuevo.Usuario  ",
      password: "temporary-password",
      role: "bedel",
      isActive: true,
      mustChangePassword: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.username).toBe("nuevo.usuario");
    expect(created.body.role).toBe("bedel");
    expect(JSON.stringify(created.body)).not.toContain("hash");

    const updated = await agent.patch("/api/admin/users/8").send({ role: "superadmin" });
    expect(updated.status).toBe(200);
    expect(updated.body.role).toBe("superadmin");

    const reset = await agent.put("/api/admin/users/8/password").send({
      newPassword: "replacement-password",
      mustChangePassword: false,
    });
    expect(reset.status).toBe(200);
    expect(reset.body.mustChangePassword).toBe(false);
    expect(JSON.stringify(reset.body)).not.toContain("new-hash");

    const audit = await agent.get("/api/admin/users/audit?limit=20&offset=0");
    expect(audit.status).toBe(200);
    expect(audit.body.total).toBe(1);
    expect(audit.body.entries[0].action).toBe("created");

    expect((await agent.delete("/api/admin/users/8")).status).toBe(204);
  });

  it("returns a conflict when an operation would remove the last active superadmin", async () => {
    const superadmin = {
      id: 7, username: "jcabrera", password: "stored-hash", role: "superadmin",
      isActive: true, mustChangePassword: false, sessionVersion: 1,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const storage = createStorage({
      validateAdminCredentials: async () => superadmin,
      getAdminUserById: async () => superadmin,
      updateManagedAdminUser: async () => {
        throw new AdminUserManagementError(
          "LAST_SUPERADMIN",
          "Debe existir al menos un superadministrador activo",
        );
      },
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));
    await agent.post("/api/auth/login").send({ username: "jcabrera", password: "valid-password" });

    const response = await agent.patch("/api/admin/users/7").send({ role: "admin" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("LAST_SUPERADMIN");
  });

  it("invalidates an open session when its version changes", async () => {
    let sessionVersion = 1;
    const currentUser = () => ({
      id: 1, username: "bedeltm", password: "stored-hash", role: "admin",
      isActive: true, mustChangePassword: false, sessionVersion,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const storage = createStorage({
      validateAdminCredentials: async () => currentUser(),
      getAdminUserById: async () => currentUser(),
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));
    await agent.post("/api/auth/login").send({ username: "bedeltm", password: "valid-password" });

    sessionVersion = 2;
    const response = await agent.get("/api/students");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("SESSION_INVALID");
  });

  it("authorizes maintenance mode by superadmin role instead of username", async () => {
    const superadmin = {
      id: 9, username: "otra.persona", password: "stored-hash", role: "superadmin",
      isActive: true, mustChangePassword: false, sessionVersion: 1,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const storage = createStorage({
      validateAdminCredentials: async () => superadmin,
      getAdminUserById: async () => superadmin,
      setSystemSetting: async () => ({ id: 1, key: "maintenance_mode", value: "true", updatedBy: "otra.persona", updatedAt: new Date() }),
    } as Partial<IStorage>);
    const agent = request.agent(buildTestApp(storage));
    await agent.post("/api/auth/login").send({ username: "otra.persona", password: "valid-password" });

    expect((await agent.post("/api/maintenance/toggle").send({ enabled: true })).status).toBe(200);
  });

  it("allows authenticated cloning even when the public read limit is exhausted", async () => {
    const cloneExamCall = vi.fn(async () => ({
      examCall: { id: 2, name: "Copia", description: null, startDate: "2027-01-01", endDate: "2027-01-02", isActive: false, createdAt: new Date() },
      clonedSchedules: 150,
    }));
    const admin = {
      id: 1,
      username: "admin",
      password: "hash",
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const storage = createStorage({
      consumeRateLimit: async (key) => key.startsWith("public-read:") ? 301 : 1,
      validateAdminCredentials: async () => admin,
      getAdminUserById: async () => admin,
      cloneExamCall,
    } as Partial<IStorage>);
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
