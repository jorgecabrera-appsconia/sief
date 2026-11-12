# Despliegue seguro del SIEF

Este procedimiento evita modificar la base productiva antes de probar el esquema y la aplicación en una rama de staging de Neon. Nunca copie credenciales a este repositorio, Excel, tickets o chats.

## Requisitos previos

- Node.js 20 y PostgreSQL Client (`pg_dump`/`pg_restore`).
- Proyecto privado nuevo en GitHub y sesión válida de GitHub CLI.
- Proyecto de Vercel Pro. El proyecto vacío `sief-castro-barros` ya fue creado, pero aún no tiene secretos ni deployments.
- Rama Neon de staging creada desde producción.
- Para cada entorno: URL pooled (`DATABASE_URL`), URL directa (`DATABASE_URL_DIRECT`) y `SESSION_SECRET` exclusivo de al menos 32 caracteres.
- Lista confirmada de administradores que deben conservarse, URL actual de Replit y ventana de publicación.

## 1. Preparar y comprobar staging

Configure las variables de staging sólo en la terminal local o en un gestor de secretos:

```powershell
$env:DATABASE_URL = "<pooled-staging>"
$env:DATABASE_URL_DIRECT = "<direct-staging>"
$env:SESSION_SECRET = "<secreto-aleatorio-staging>"
```

Ejecute el inventario sin datos personales y guárdelo fuera de Git:

```powershell
npm run db:inventory *> inventory-staging.json
```

Cree un respaldo de la rama antes de migrarla:

```powershell
./scripts/backup-database.ps1
```

Aplique las tablas de sesiones y rate limiting, convierta las contraseñas heredadas a bcrypt y verifique el código:

```powershell
npm run db:prepare-deployment
npm run db:hash-admin-passwords
npm run check
npm test -- --run
npm run build
npm audit --omit=dev --audit-level=high
```

No use `db:push` en producción. Las contraseñas funcionales pueden mantenerse durante la conversión a hash, pero deben rotarse dentro de los siete días posteriores a la publicación.

## 2. Configurar Vercel

En Vercel, cargue variables sensibles sin pegarlas en comandos versionados:

```powershell
npx vercel env add DATABASE_URL preview
npx vercel env add DATABASE_URL_DIRECT preview
npx vercel env add SESSION_SECRET preview
npx vercel env add DATABASE_URL production
npx vercel env add DATABASE_URL_DIRECT production
npx vercel env add SESSION_SECRET production
```

Preview debe apuntar exclusivamente a Neon staging. Production debe apuntar exclusivamente a Neon producción y usar otro `SESSION_SECRET`. La función está configurada en `cle1`, próxima a Neon `us-east-2`, con Node.js 20; el frontend se publica desde `dist/public`.

## 3. GitHub y controles

La rama local `codex/deploy-clean` contiene una única confirmación saneada, sin el historial anterior de Replit. Reautentique GitHub CLI de forma interactiva y publique sólo esa rama en un repositorio privado nuevo:

```powershell
gh auth login -h github.com
gh repo create sief-castro-barros --private --source . --remote github
git push -u github codex/deploy-clean:main
```

Antes de fusionar a `main`, GitHub Actions debe aprobar TypeScript, 34 pruebas, build y auditoría sin vulnerabilidades altas o críticas. Dependabot queda configurado semanalmente.

## 4. Validar Preview

Despliegue la rama de trabajo sólo después de cargar los secretos de staging:

```powershell
npx vercel deploy
```

Pruebe en móvil y escritorio: registro nuevo, alumno existente con contacto coincidente, duplicado, mesa cerrada, llamado inactivo, consulta de estado, portal docente, administración, exportaciones y documentos.

Con `k6` instalado, ejecute la prueba de carga contra Preview:

```powershell
$env:BASE_URL = "https://<preview>.vercel.app"
k6 run load-tests/public-read.js
```

El umbral configurado exige cero respuestas fallidas y p95 menor a dos segundos con 25 usuarios durante cinco minutos.

## 5. Publicar

Durante la ventana de 45 minutos:

1. Active mantenimiento en Replit.
2. Configure las URLs directas de producción sólo en la terminal y ejecute inventario más respaldo final.
3. Aplique `npm run db:prepare-deployment` y `npm run db:hash-admin-passwords` sobre producción.
4. Fusione a `main` o ejecute `npx vercel deploy --prod`.
5. Compruebe login, registro, estado y portal docente desde la URL de Vercel.
6. Ejecute la prueba de carga y habilite inscripciones.
7. Detenga o redirija Replit para impedir escrituras paralelas.

Si falla, restaure el deployment anterior desde Vercel. Si la migración de base fuese incompatible, restaure la rama o el dump de Neon creado inmediatamente antes de publicar.

## 6. Operación

- Active alertas de errores y latencia en Vercel Observability.
- Revise semanalmente consumo y límites de Vercel y Neon.
- Pruebe periódicamente `pg_restore` sobre una rama Neon descartable.
- Rote inmediatamente la contraseña Neon y el secreto de sesión que estuvieron en el Excel original; luego elimine ese archivo del almacenamiento compartido seguro cuando ya no sea necesario.
