import { describe, expect, it, vi } from "vitest";
import {
  hydrateInscriptions,
  loadActiveCallInscriptions,
} from "./inscription-hydration";

describe("hydrateInscriptions", () => {
  it("joins students and schedules in memory while preserving conditions", () => {
    const createdAt = new Date("2026-11-24T12:00:00.000Z");
    const inscriptions = [
      {
        id: 10,
        studentId: 20,
        examScheduleIds: ["30", "999"],
        examConditions: ["libre", "regular"],
        status: "pending",
        confirmedBy: null,
        confirmedAt: null,
        permissionNumber: null,
        createdAt,
      },
    ];
    const students = [
      {
        id: 20,
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
        createdAt,
      },
    ];
    const schedules = [
      {
        id: 30,
        examCallId: 7,
        subject: "Biología",
        year: 2,
        profesorado: "Biología",
        turno: "siesta",
        division: "A",
        date: "2026-11-30",
        time: "18:00",
        teacher: "Docente",
        presidente: "Presidente",
        vocal1: "Vocal 1",
        vocal2: "Vocal 2",
        vocalSuplente: "Suplente",
        period: "Noviembre 2026",
        registrationOpen: true,
        createdAt,
      },
    ];

    const [result] = hydrateInscriptions(inscriptions, students, schedules);

    expect(result.student).toEqual(students[0]);
    expect(result.examSchedules).toEqual([{ ...schedules[0], condition: "libre" }]);
  });
});

describe("loadActiveCallInscriptions", () => {
  it("hydrates inscriptions using only schedules from the active exam call", async () => {
    const createdAt = new Date("2026-11-24T12:00:00.000Z");
    const activeCall = {
      id: 7,
      name: "Noviembre 2026",
      description: null,
      startDate: "2026-11-23",
      endDate: "2026-12-03",
      isActive: true,
      createdAt,
    };
    const inscriptions = [{
      id: 10,
      studentId: 20,
      examScheduleIds: ["30", "40"],
      examConditions: ["libre", "regular"],
      status: "pending",
      confirmedBy: null,
      confirmedAt: null,
      permissionNumber: null,
      createdAt,
    }];
    const students = [{
      id: 20,
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
      createdAt,
    }];
    const activeSchedules = [{
      id: 30,
      examCallId: 7,
      subject: "Biología",
      year: 2,
      profesorado: "Biología",
      turno: "siesta",
      division: "A",
      date: "2026-11-30",
      time: "18:00",
      teacher: "Docente",
      presidente: "Presidente",
      vocal1: "Vocal 1",
      vocal2: "Vocal 2",
      vocalSuplente: "Suplente",
      period: "Noviembre 2026",
      registrationOpen: true,
      createdAt,
    }];
    const storage = {
      getActiveExamCall: vi.fn().mockResolvedValue(activeCall),
      getInscriptionsByExamCallId: vi.fn().mockResolvedValue(inscriptions),
      getAllStudents: vi.fn().mockResolvedValue(students),
      getExamSchedulesByExamCallId: vi.fn().mockResolvedValue(activeSchedules),
    };

    const result = await loadActiveCallInscriptions(storage);

    expect(result).toEqual([{
      ...inscriptions[0],
      student: students[0],
      examSchedules: [{ ...activeSchedules[0], condition: "libre" }],
    }]);
    expect(storage.getInscriptionsByExamCallId).toHaveBeenCalledWith(7);
    expect(storage.getExamSchedulesByExamCallId).toHaveBeenCalledWith(7);
  });

  it("returns no inscriptions when there is no active exam call", async () => {
    const storage = {
      getActiveExamCall: vi.fn().mockResolvedValue(undefined),
      getInscriptionsByExamCallId: vi.fn(),
      getAllStudents: vi.fn(),
      getExamSchedulesByExamCallId: vi.fn(),
    };

    await expect(loadActiveCallInscriptions(storage)).resolves.toEqual([]);
    expect(storage.getInscriptionsByExamCallId).not.toHaveBeenCalled();
  });
});
