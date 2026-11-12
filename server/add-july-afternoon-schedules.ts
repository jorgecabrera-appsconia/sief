import { db } from "./db";
import { examSchedules } from "@shared/schema";
import { julyAfternoonExamSchedules } from "./july-afternoon-exam-schedules-data";

async function addJulyAfternoonSchedules() {
  try {
    console.log("🌅 Insertando mesas de examen de Julio 2025 - Turno Tarde...");
    
    // Insert all July afternoon exam schedules
    await db.insert(examSchedules).values(julyAfternoonExamSchedules);
    
    console.log(`✅ ${julyAfternoonExamSchedules.length} mesas de examen de Julio - Turno Tarde insertadas`);
    console.log("🎉 Inserción completada exitosamente");
    
  } catch (error) {
    console.error("❌ Error durante la inserción:", error);
    throw error;
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addJulyAfternoonSchedules()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { addJulyAfternoonSchedules };