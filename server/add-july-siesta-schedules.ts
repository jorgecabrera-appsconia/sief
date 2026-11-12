import { db } from "./db";
import { examSchedules } from "@shared/schema";
import { julySiestaExamSchedules } from "./july-siesta-exam-schedules-data";

async function addJulySiestaSchedules() {
  try {
    console.log("🕐 Insertando mesas de examen de Julio 2025 - Turno Siesta (Biología)...");
    
    // Insert all July siesta exam schedules
    await db.insert(examSchedules).values(julySiestaExamSchedules);
    
    console.log(`✅ ${julySiestaExamSchedules.length} mesas de examen de Julio - Turno Siesta insertadas`);
    console.log("🎉 Inserción completada exitosamente");
    
  } catch (error) {
    console.error("❌ Error durante la inserción:", error);
    throw error;
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addJulySiestaSchedules()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { addJulySiestaSchedules };