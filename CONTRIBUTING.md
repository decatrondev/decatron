# Contributing to Decatron

> Español: [CONTRIBUTING.es.md](CONTRIBUTING.es.md)

Thank you for your interest in contributing to Decatron. This document provides guidelines to ensure a smooth collaboration.

## Getting Started

1. **Fork** the repository and create a feature branch from `main`.
2. Set up your local environment following [README.md](README.md#getting-started); for a server, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
3. Make sure the project builds before submitting changes:
   - Backend: `dotnet build`
   - Frontend: `cd ClientApp && npm run build`
   - Frontend types: `cd ClientApp && npx tsc --noEmit -p tsconfig.app.json` (plain `npx tsc --noEmit` does not check the app, because the root `tsconfig.json` only references the other projects)

## Code Guidelines

### Backend (.NET 8)

- Controllers delegate logic to services; keep controllers thin.
- Services use `DecatronDbContext` (EF Core) for data access. Avoid raw SQL.
- Use structured logging: `_logger.LogInformation("Processing {EventType} for {Channel}", type, channel)`.
- Add `[RequirePermission]` or `[Authorize]` attributes to all new authenticated endpoints.
- Never expose `ex.Message` in HTTP responses. Log the error and return a generic message.
- The database schema is not created by the backend. A change that needs new tables or columns comes with a SQL script in `Decatron.Data/Migrations/` (applied by hand), and the baseline in `Decatron.Data/Schema/` is only regenerated when the maintainers decide to.

### Frontend (React + TypeScript)

- Use the shared `api` service (`services/api.ts`) for all HTTP requests.
- Use `useTranslation` from `react-i18next` for all user-facing strings, and add the text in both languages (`ClientApp/public/locales/es` and `en`).
- Overlay pages connect with SignalR to the hub of their module (`/hubs/overlay` for most overlays, `/hubs/songrequest` for the Song Request overlay) and must reconnect automatically.
- Keep overlay endpoints anonymous (`[AllowAnonymous]`): they load as OBS Browser Sources without a session.
- Follow the design system described in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) instead of hard-coding colors.

### General

- Test your changes with both English and Spanish language settings.
- Do not commit `.env` files, secrets, or credentials.
- Keep commits focused and descriptive.
- If you change something users can see, update the documentation that describes it (`README.md`, `docs/` and the matching file in `docs/es/`).

## Commit Convention

```
feat: add new feature
fix: fix a bug
refactor: code refactoring without behavior change
docs: documentation changes
style: formatting, missing semicolons, etc.
chore: maintenance tasks
```

## Pull Requests

- Keep PRs focused on a single feature or fix.
- Include a clear description of what changed and why.
- Reference related issues if applicable.

## Reporting Issues

Open an issue on [GitHub Issues](https://github.com/decatrondev/decatron/issues) with:
- A clear title and description.
- Steps to reproduce (if applicable).
- Expected vs actual behavior.

## License

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0](LICENSE).

---

Thank you for helping make Decatron better.
