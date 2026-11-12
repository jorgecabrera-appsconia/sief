import { db } from "./db";
import { subjects, correlativities } from "@shared/schema";
import { eq, and, ilike } from "drizzle-orm";

// Define subject data with years for each profesorado
const subjectsByProfesorado = {
  "Educación Inicial": {
    1: [
      "Pedagogía", "Didáctica General I", "Sujetos de la Educación Inicial I", 
      "Taller: Lectura y Escritura Académica", "La Lengua y su Enseñanza", 
      "Práctica I", "Lenguajes Artísticos", "Problemática Contemporánea de la Educación Inicial",
      "Filosofía"
    ],
    2: [
      "Psicología Educacional", "Didáctica General II", "Historia y Política de la Educación Argentina",
      "Taller: Lenguaje Corporal y Plástica Visual", "Literatura Infantil y su Enseñanza",
      "Matemática y su Enseñanza", "Didáctica de la Educación Inicial I", "Práctica II",
      "Taller: Educación Sexual Integral (ESI)"
    ],
    3: [
      "Didáctica de la Educación Inicial II", "Ciencias Sociales y su Enseñanza",
      "Las Prácticas del Lenguaje y su Enseñanza", "Ciencias Naturales y su Enseñanza",
      "Lenguaje Musical", "Práctica III", "Sociología de la Educación"
    ],
    4: [
      "El Juego y su Didáctica", "El Juego y la Enseñanza de la Matemática",
      "Alfabetización Inicial y Cultural", "Taller: Educación para la Salud y Educación Ambiental",
      "Investigación Educativa", "Residencia Pedagógica"
    ]
  },
  "Educación Primaria": {
    1: [
      "Pedagogía", "Matemática", "Lengua y Literatura", "Ciencias Naturales",
      "Historia", "Geografía", "Práctica I", "Sujeto de la Educación Primaria",
      "Filosofía"
    ],
    2: [
      "Psicología Educacional", "Didáctica General", "Didáctica de la Matemática I",
      "Didáctica de la Lengua y la Literatura I", "Didáctica de las Ciencias Naturales I",
      "Didáctica de las Ciencias Sociales I", "Práctica II"
    ],
    3: [
      "Investigación Educativa", "Didáctica de la Lengua y la Literatura II",
      "Alfabetización Inicial", "Didáctica de la Matemática II", 
      "Didáctica de las Ciencias Naturales II", "Didáctica de las Ciencias Sociales II",
      "Lenguaje Corporal y Plástica Visual", "Práctica III"
    ],
    4: [
      "Ética y Deontología Docente", "Lenguaje Musical", "Educación Física",
      "Residencia Pedagógica"
    ]
  },
  "Biología": {
    1: [
      "Pedagogía", "Filosofía", "Biología General", "Biología Celular y Molecular",
      "Química General", "Modelos Físicos para las Ciencias Naturales", "Práctica I"
    ],
    2: [
      "Didáctica General", "Biología Vegetal", "Química Biológica", "Taller: Trabajo Experimental",
      "Sujetos de la Educación Secundaria", "Didácticas de las Ciencias Naturales",
      "Práctica II", "Investigación Educativa", "Biología Animal"
    ],
    3: [
      "Biología Humana y Salud", "Didáctica de la Biología", "Biología de los Microorganismos y Hongos",
      "Ciencias de la Tierra", "Epistemología e Historia de la Biología", "Práctica III",
      "Taller: Educación Sexual Integral (ESI)", "Problemática Contemporánea de la Educación Secundaria"
    ],
    4: [
      "Ética y Deontología Docente", "Genética y Evolución", "Ecología y Educación Ambiental",
      "Práctica IV - Residencia Pedagógica"
    ]
  }
};

// Correlativities data from CSV files
const correlativitiesData = {
  "Educación Inicial": [
    { subject: "Psicología Educacional", prerequisites: ["Psicología Educacional"] },
    { subject: "Didáctica General II", prerequisites: ["Pedagogía", "Didáctica General I"] },
    { subject: "Historia y Política de la Educación Argentina", prerequisites: ["Problemática Contemporánea de la Educación Inicial"] },
    { subject: "Taller: Lenguaje Corporal y Plástica Visual", prerequisites: ["Lenguajes Artísticos"] },
    { subject: "Literatura Infantil y su Enseñanza", prerequisites: ["Taller: Lectura y Escritura Académica", "La Lengua y su Enseñanza", "Didáctica General I"] },
    { subject: "Matemática y su Enseñanza", prerequisites: ["Didáctica General I"] },
    { subject: "Didáctica de la Educación Inicial I", prerequisites: ["Pedagogía", "Didáctica General I", "Sujetos de la Educación Inicial I"] },
    { subject: "Práctica II", prerequisites: ["Psicología Educacional", "Práctica I"] },
    { subject: "Taller: Educación Sexual Integral (ESI)", prerequisites: ["Sujetos de la Educación Inicial I"] },
    { subject: "Didáctica de la Educación Inicial II", prerequisites: ["Didáctica General II", "Didáctica de la Educación Inicial I"] },
    { subject: "Ciencias Sociales y su Enseñanza", prerequisites: ["Didáctica General II"] },
    { subject: "Las Prácticas del Lenguaje y su Enseñanza", prerequisites: ["Didáctica General II", "Literatura Infantil y su Enseñanza", "Didáctica de la Educación Inicial I"] },
    { subject: "Ciencias Naturales y su Enseñanza", prerequisites: ["Didáctica General II"] },
    { subject: "Lenguaje Musical", prerequisites: ["Taller: Lenguaje Corporal y Plástica Visual"] },
    { subject: "Práctica III", prerequisites: ["Taller: Lectura y Escritura Académica", "Didáctica General II", "Didáctica de la Educación Inicial I", "Práctica II"] },
    { subject: "Sociología de la Educación", prerequisites: ["Problemática Contemporánea de la Educación Inicial"] },
    { subject: "El Juego y su Didáctica", prerequisites: ["Didáctica de la Educación Inicial I", "Didáctica de la Educación Inicial II"] },
    { subject: "El Juego y la Enseñanza de la Matemática", prerequisites: ["Didáctica General II", "Matemática y su Enseñanza"] },
    { subject: "Alfabetización Inicial y Cultural", prerequisites: ["Las Prácticas del Lenguaje y su Enseñanza"] },
    { subject: "Taller: Educación para la Salud y Educación Ambiental", prerequisites: ["Ciencias Naturales y su Enseñanza", "Taller: Educación Sexual Integral (ESI)"] },
    { subject: "Investigación Educativa", prerequisites: ["Taller: Lectura y Escritura Académica"] },
    { subject: "Residencia Pedagógica", prerequisites: ["Didáctica de la Educación Inicial II", "Ciencias Sociales y su Enseñanza", "Las Prácticas del Lenguaje y su Enseñanza", "Ciencias Naturales y su Enseñanza", "Lenguaje Musical", "Práctica III"] }
  ],
  "Educación Primaria": [
    { subject: "Psicología Educacional", prerequisites: ["Pedagogía"] },
    { subject: "Didáctica General", prerequisites: ["Pedagogía"] },
    { subject: "Didáctica de la Matemática I", prerequisites: ["Matemática"] },
    { subject: "Didáctica de la Lengua y la Literatura I", prerequisites: ["Lengua y Literatura"] },
    { subject: "Didáctica de las Ciencias Naturales I", prerequisites: ["Ciencias Naturales"] },
    { subject: "Didáctica de las Ciencias Sociales I", prerequisites: ["Historia", "Geografía"] },
    { subject: "Práctica II", prerequisites: ["Matemática", "Lengua y Literatura", "Práctica I"] },
    { subject: "Investigación Educativa", prerequisites: ["Didáctica General"] },
    { subject: "Didáctica de la Lengua y la Literatura II", prerequisites: ["Didáctica de la Lengua y la Literatura I"] },
    { subject: "Alfabetización Inicial", prerequisites: ["Sujeto de la Educación Primaria", "Didáctica de la Lengua y la Literatura I"] },
    { subject: "Didáctica de la Matemática II", prerequisites: ["Didáctica de la Matemática I"] },
    { subject: "Didáctica de las Ciencias Naturales II", prerequisites: ["Didáctica de las Ciencias Naturales I"] },
    { subject: "Didáctica de las Ciencias Sociales II", prerequisites: ["Didáctica de las Ciencias Sociales I"] },
    { subject: "Lenguaje Corporal y Plástica Visual", prerequisites: ["Sujeto de la Educación Primaria"] },
    { subject: "Práctica III", prerequisites: ["Pedagogía", "Didáctica de la Matemática I", "Didáctica de la Lengua y la Literatura I", "Práctica II"] },
    { subject: "Ética y Deontología Docente", prerequisites: ["Filosofía"] },
    { subject: "Lenguaje Musical", prerequisites: ["Lenguaje Corporal y Plástica Visual"] },
    { subject: "Educación Física", prerequisites: ["Lenguaje Corporal y Plástica Visual"] },
    { subject: "Residencia Pedagógica", prerequisites: ["Investigación Educativa", "Alfabetización Inicial", "Didáctica de las Ciencias Naturales II", "Didáctica de las Ciencias Sociales II", "Lenguaje Corporal y Plástica Visual", "Didáctica de la Lengua y la Literatura II", "Didáctica de la Matemática II", "Práctica III"] }
  ],
  "Biología": [
    { subject: "Didáctica General", prerequisites: ["Pedagogía"] },
    { subject: "Biología Vegetal", prerequisites: ["Biología General", "Biología Celular y Molecular"] },
    { subject: "Química Biológica", prerequisites: ["Biología General", "Biología Celular y Molecular"] },
    { subject: "Taller: Trabajo Experimental", prerequisites: ["Química General"] },
    { subject: "Sujetos de la Educación Secundaria", prerequisites: ["Biología General"] },
    { subject: "Didácticas de las Ciencias Naturales", prerequisites: ["Problemática Contemporánea de la Educación Secundaria"] },
    { subject: "Práctica II", prerequisites: ["Pedagogía", "Modelos Físicos para las Ciencias Naturales", "Química General"] },
    { subject: "Investigación Educativa", prerequisites: ["Didáctica General"] },
    { subject: "Biología Humana y Salud", prerequisites: ["Biología General", "Biología Animal", "Química Biológica"] },
    { subject: "Didáctica de la Biología", prerequisites: ["Didáctica General", "Biología Animal", "Biología Vegetal", "Didácticas de las Ciencias Naturales"] },
    { subject: "Biología de los Microorganismos y Hongos", prerequisites: ["Biología General", "Química General", "Química Biológica"] },
    { subject: "Ciencias de la Tierra", prerequisites: ["Biología Animal", "Biología Vegetal", "Química Biológica"] },
    { subject: "Epistemología e Historia de la Biología", prerequisites: ["Filosofía", "Biología General", "Biología Celular y Molecular", "Didácticas de las Ciencias Naturales"] },
    { subject: "Práctica III", prerequisites: ["Pedagogía", "Biología Animal", "Biología Vegetal", "Química Biológica", "Taller: Trabajo Experimental", "Práctica II"] },
    { subject: "Taller: Educación Sexual Integral (ESI)", prerequisites: ["Biología Humana y Salud"] },
    { subject: "Ética y Deontología Docente", prerequisites: ["Filosofía"] },
    { subject: "Genética y Evolución", prerequisites: ["Biología Humana y Salud", "Ciencias de la Tierra"] },
    { subject: "Ecología y Educación Ambiental", prerequisites: ["Biología Animal", "Biología Vegetal", "Ciencias de la Tierra"] },
    { subject: "Práctica IV - Residencia Pedagógica", prerequisites: ["Didáctica de la Biología", "Biología de los Microorganismos y Hongos", "Epistemología e Historia de la Biología", "Práctica III"] }
  ]
};

async function seedSubjectsAndCorrelativities() {
  try {
    console.log("Starting subjects and correlativities seeding...");
    
    // Create subjects for each profesorado
    for (const [profesorado, yearSubjects] of Object.entries(subjectsByProfesorado)) {
      for (const [year, subjectNames] of Object.entries(yearSubjects)) {
        for (const subjectName of subjectNames) {
          // Check if subject already exists (match by name + profesorado only).
          // Year is intentionally excluded: some subjects were re-assigned to a
          // different year in the database than the canonical seed list, and
          // including year here would re-insert them as duplicates on each run.
          const existing = await db.select()
            .from(subjects)
            .where(and(
              ilike(subjects.name, subjectName),
              eq(subjects.profesorado, profesorado)
            ));
          
          if (existing.length === 0) {
            await db.insert(subjects).values({
              name: subjectName,
              profesorado,
              year: parseInt(year)
            });
            console.log(`Created subject: ${subjectName} - ${profesorado} - Year ${year}`);
          }
        }
      }
    }
    
    // Create correlativities
    for (const [profesorado, correlativitiesList] of Object.entries(correlativitiesData)) {
      for (const correlData of correlativitiesList) {
        // Find the main subject
        const mainSubject = await db.select()
          .from(subjects)
          .where(and(
            eq(subjects.name, correlData.subject),
            eq(subjects.profesorado, profesorado)
          ));
        
        if (mainSubject.length === 0) {
          console.log(`Subject not found: ${correlData.subject} in ${profesorado}`);
          continue;
        }
        
        // Find prerequisite subjects and create correlativities
        for (const prerequisiteName of correlData.prerequisites) {
          const prerequisiteSubject = await db.select()
            .from(subjects)
            .where(and(
              eq(subjects.name, prerequisiteName),
              eq(subjects.profesorado, profesorado)
            ));
          
          if (prerequisiteSubject.length === 0) {
            console.log(`Prerequisite subject not found: ${prerequisiteName} in ${profesorado}`);
            continue;
          }
          
          // Check if correlativity already exists
          const existingCorrelativity = await db.select()
            .from(correlativities)
            .where(and(
              eq(correlativities.subjectId, mainSubject[0].id),
              eq(correlativities.prerequisiteSubjectId, prerequisiteSubject[0].id)
            ));
          
          if (existingCorrelativity.length === 0) {
            await db.insert(correlativities).values({
              subjectId: mainSubject[0].id,
              prerequisiteSubjectId: prerequisiteSubject[0].id
            });
            console.log(`Created correlativity: ${correlData.subject} requires ${prerequisiteName}`);
          }
        }
      }
    }
    
    console.log("Subjects and correlativities seeding completed!");
  } catch (error) {
    console.error("Error seeding subjects and correlativities:", error);
    throw error;
  }
}

// Export the seeder function instead of running it immediately
export { seedSubjectsAndCorrelativities };