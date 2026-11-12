import { db } from "./db";
import { examSchedules } from "@shared/schema";
import { julyMorningExamSchedules } from "./july-morning-exam-schedules-data";

async function addJulyMorningSchedules() {
  try {
    console.log("🌱 Insertando mesas de examen de Julio 2025 - Turno Mañana...");
    
    // Insert all July morning exam schedules
    await db.insert(examSchedules).values(julyMorningExamSchedules);
    
    console.log(`✅ ${julyMorningExamSchedules.length} mesas de examen de Julio insertadas`);
    console.log("🎉 Inserción completada exitosamente");
    
  } catch (error) {
    console.error("❌ Error durante la inserción:", error);
    throw error;
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addJulyMorningSchedules()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { addJulyMorningSchedules };