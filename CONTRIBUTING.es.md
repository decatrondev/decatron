# Contribuir a Decatron

> English: [CONTRIBUTING.md](CONTRIBUTING.md)

Gracias por tu interés en contribuir a Decatron. Este documento reúne las pautas para que la colaboración sea fluida.

## Primeros pasos

1. Haz un **fork** del repositorio y crea una rama de funcionalidad a partir de `main`.
2. Prepara tu entorno local siguiendo [README.es.md](README.es.md#primeros-pasos); para un servidor, consulta [docs/es/DEPLOYMENT.md](docs/es/DEPLOYMENT.md).
3. Asegúrate de que el proyecto compile antes de enviar cambios:
   - Backend: `dotnet build`
   - Frontend: `cd ClientApp && npm run build`
   - Tipos del frontend: `cd ClientApp && npx tsc --noEmit -p tsconfig.app.json` (un `npx tsc --noEmit` sin más no revisa la aplicación, porque el `tsconfig.json` de la raíz solo referencia los demás proyectos)

## Pautas de código

### Backend (.NET 8)

- Los controladores delegan la lógica en servicios; mantén los controladores delgados.
- Los servicios usan `DecatronDbContext` (EF Core) para acceder a los datos. Evita el SQL directo.
- Usa registros estructurados: `_logger.LogInformation("Processing {EventType} for {Channel}", type, channel)`.
- Agrega `[RequirePermission]` o `[Authorize]` a todos los endpoints autenticados nuevos.
- Nunca expongas `ex.Message` en las respuestas HTTP. Registra el error y devuelve un mensaje genérico.
- El backend no crea el esquema de la base de datos. Un cambio que necesite tablas o columnas nuevas incluye un script SQL en `Decatron.Data/Migrations/` (se aplica a mano), y el esquema base de `Decatron.Data/Schema/` solo lo regeneran los mantenedores cuando lo deciden.

### Frontend (React + TypeScript)

- Usa el servicio compartido `api` (`services/api.ts`) para todas las solicitudes HTTP.
- Usa `useTranslation` de `react-i18next` para todos los textos visibles y agrega el texto en ambos idiomas (`ClientApp/public/locales/es` y `en`).
- Las páginas de overlay se conectan con SignalR al hub de su módulo (`/hubs/overlay` en la mayoría, `/hubs/songrequest` en el overlay de Song Request) y deben reconectarse automáticamente.
- Mantén anónimos los endpoints de los overlays (`[AllowAnonymous]`): se cargan como fuentes de navegador de OBS sin sesión.
- Sigue el sistema de diseño descrito en [docs/es/DESIGN_SYSTEM.md](docs/es/DESIGN_SYSTEM.md) en lugar de escribir colores a mano.

### General

- Prueba tus cambios con la configuración de idioma en inglés y en español.
- No subas archivos `.env`, secretos ni credenciales.
- Mantén los commits enfocados y descriptivos.
- Si cambias algo que los usuarios ven, actualiza la documentación que lo describe (`README.md`, `docs/` y el archivo equivalente de `docs/es/`).

## Convención de commits

```
feat: agrega una funcionalidad nueva
fix: corrige un error
refactor: refactorización sin cambio de comportamiento
docs: cambios de documentación
style: formato, puntos y comas faltantes, etc.
chore: tareas de mantenimiento
```

## Pull requests

- Mantén cada PR enfocado en una sola funcionalidad o corrección.
- Incluye una descripción clara de qué cambió y por qué.
- Referencia los issues relacionados si corresponde.

## Reportar problemas

Abre un issue en [GitHub Issues](https://github.com/decatrondev/decatron/issues) con:
- Un título y una descripción claros.
- Pasos para reproducirlo (si corresponde).
- Comportamiento esperado frente al real.

## Licencia

Al contribuir, aceptas que tus contribuciones se licencien bajo la [Licencia Pública General Affero de GNU v3.0](LICENSE).

---

Gracias por ayudar a mejorar Decatron.
