import { db } from "./db";
import { examSchedules } from "@shared/schema";
import { morningExamSchedules } from './exam-schedules-data';
import { afternoonExamSchedules } from './afternoon-exam-schedules-data';

async function seedDatabase() {
  console.log("🌱 Iniciando seedeo de la base de datos...");

  try {
    // Verificar si ya existen datos
    const existingSchedules = await db.select().from(examSchedules).limit(1);

    // Poblar mesas de examen si no existen
    if (existingSchedules.length === 0) {
      console.log("📅 Insertando mesas de examen reales del documento institucional...");
      
      // Insertar mesas del turno mañana
      await db.insert(examSchedules).values(morningExamSchedules);
      console.log(`✅ ${morningExamSchedules.length} mesas del turno mañana insertadas`);
      
      // Insertar mesas del turno tarde
      await db.insert(examSchedules).values(afternoonExamSchedules);
      console.log(`✅ ${afternoonExamSchedules.length} mesas del turno tarde insertadas`);
      
      console.log(`✅ Total: ${morningExamSchedules.length + afternoonExamSchedules.length} mesas de examen insertadas`);
    } else {
      console.log("📅 Las mesas de examen ya existen en la base de datos");
    }

    console.log("🎉 Seedeo completado exitosamente");
    
  } catch (error) {
    console.error("❌ Error durante el seedeo:", error);
    throw error;
  }
}

// Ejecutar seedeo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase };
