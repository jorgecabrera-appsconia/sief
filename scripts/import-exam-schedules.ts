import { db } from "../server/db";
import { examSchedules } from "@shared/schema";
import fs from "fs";
import path from "path";

async function importExamSchedules() {
  try {
    console.log("Starting import of exam schedules...");
    
    const csvPath = path.join(process.cwd(), "attached_assets", "exam_schedules (mesas Diciembre 2025)_1761777445876.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");
    
    let imported = 0;
    let errors = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line (handling quoted values)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            current += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length < 16) {
        console.log(`Skipping line ${i + 1}: insufficient data`);
        errors++;
        continue;
      }
      
      try {
        // Parse registration_open (convert "true"/"false" string to boolean)
        const registrationOpen = values[15].toLowerCase() === 'true';
        
        await db.insert(examSchedules).values({
          subject: values[1],
          year: parseInt(values[2]),
          profesorado: values[3],
          turno: values[4],
          date: values[5],
          time: values[6],
          teacher: values[7],
          presidente: values[8],
          vocal1: values[9],
          vocal2: values[10],
          vocalSuplente: values[11],
          division: values[13],
          period: values[14],
          registrationOpen: registrationOpen,
        });
        
        imported++;
        if (imported % 50 === 0) {
          console.log(`Imported ${imported} exam schedules...`);
        }
      } catch (error) {
        console.error(`Error importing line ${i + 1}:`, error);
        errors++;
      }
    }
    
    console.log(`\n✅ Import completed!`);
    console.log(`   Successfully imported: ${imported} exam schedules`);
    console.log(`   Errors: ${errors}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Fatal error during import:", error);
    process.exit(1);
  }
}

importExamSchedules();
