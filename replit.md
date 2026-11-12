# Sistema de Inscripción a Exámenes - ISFD "Dr. Pedro Ignacio de Castro Barros"

## Overview
This project is a full-stack web application for managing exam registrations at the Instituto Superior de Formación Docente "Dr. Pedro Ignacio de Castro Barros". Its primary purpose is to streamline the exam registration process for students across three distinct academic programs (Educación Inicial, Educación Primaria, and Biología) and provide an efficient administrative interface for managing exam schedules and inscriptions. The system aims to digitalize and enhance the current manual processes, offering features such as DNI validation, multi-subject selection, PDF confirmation generation, and comprehensive administrative CRUD operations for exam schedules. The business vision is to provide a robust, scalable, and user-friendly platform that improves operational efficiency for the institution and simplifies the registration experience for students, ultimately reducing administrative burden and enhancing data accuracy.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Vite for fast development and optimized builds. Styling is managed with Tailwind CSS and the shadcn/ui component library, which wraps Radix UI primitives. State management is handled by TanStack Query, form handling by React Hook Form with Zod validation, and routing by Wouter. PDF generation for student confirmations is done using jsPDF. The UI/UX prioritizes a professional institutional design, responsive layouts for mobile support, and clear, intuitive user flows.

### Backend Architecture
The backend is developed with Node.js and Express.js, written in TypeScript. It uses PostgreSQL as the database, accessed via Drizzle ORM. Neon Database provides serverless PostgreSQL hosting. Session management is implemented with Express sessions, storing session data in PostgreSQL. Development uses `tsx` for TypeScript execution.

### Core Features
- **Student Registration**: Multi-step form with DNI validation, multi-subject selection, and PDF confirmation. Supports registration for current exam periods and displays archived periods as read-only.
- **Administrative Panel**: CRUD operations for exam schedules, including subject, year, program, date, time, and tribunal composition. Features an exam schedule archival system, period-based organization, and a manual approval workflow for inscriptions (pending → confirmed/rejected). Includes an advanced filtering system by Profesorado, Turno, Año, División, and Materia.
- **PDF Generation**: Creates registration confirmation documents for students and "Acta Volante de Exámenes" for administrators, including sequential permission numbering.
- **Reporting**: Excel export functionality for exam schedules and inscription data.
- **Maintenance Mode**: A superadmin-controlled system to temporarily block public access while keeping the admin panel functional.
- **Authentication**: Session-based authentication for administrative users with role-based access control.

### Database Schema Highlights
- **Students**: Stores personal and academic data including phone, email, turno, and year entered.
- **ExamSchedules**: Detailed exam information including subject, year, program, date, time, teacher, and full tribunal composition (presidente, vocal1, vocal2, vocalSuplente). Includes `period` and `registrationOpen` fields for archival and active status management.
- **Inscriptions**: Links students to exam schedules with status tracking and `permissionNumber` for confirmed registrations.
- **AdminUsers**: Manages administrative accounts and roles.

## External Dependencies

- **Database & ORM**: `@neondatabase/serverless`, `drizzle-orm`, `drizzle-zod`, `connect-pg-simple`
- **Frontend Frameworks**: `react`, `@radix-ui/react-*`, `tailwindcss`
- **Form Management**: `react-hook-form`, `@hookform/resolvers`, `zod`
- **PDF Generation**: `jspdf`
- **HTTP Client**: `tanstack/react-query`
- **Development Tools**: `typescript`, `vite`, `eslint`, `prettier`, `drizzle-kit`