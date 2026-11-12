import { db } from "./db";
import { examSchedules } from "@shared/schema";
import { afternoonExamSchedules } from './afternoon-exam-schedules-data';

async function addAfternoonSchedules() {
  console.log("🌅 Agregando mesas del turno tarde...");

  try {
    // Insertar mesas del turno tarde
    await db.insert(examSchedules).values(afternoonExamSchedules);
    console.log(`✅ ${afternoonExamSchedules.length} mesas del turno tarde agregadas exitosamente`);
    
  } catch (error) {
    console.error("❌ Error al agregar mesas del turno tarde:", error);
    throw error;
  }
}

addAfternoonSchedules()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));