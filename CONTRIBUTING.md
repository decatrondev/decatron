# Contributing to Decatron

Thank you for your interest in contributing to Decatron. This document provides guidelines to ensure a smooth collaboration.

## Getting Started

1. **Fork** the repository and create a feature branch from `main`.
2. Set up your local environment following the instructions in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
3. Make sure the project builds successfully before submitting changes.

## Code Guidelines

### Backend (.NET 8)

- Controllers delegate logic to services; keep controllers thin.
- Services use `DecatronDbContext` (EF Core) for data access. Avoid raw SQL.
- Use structured logging: `_logger.LogInformation("Processing {EventType} for {Channel}", type, channel)`.
- Add `[RequirePermission]` or `[Authorize]` attributes to all new authenticated endpoints.
- Never expose `ex.Message` in HTTP responses. Log the error and return a generic message.

### Frontend (React + TypeScript)

- Use the shared `api` service (`services/api.ts`) for all HTTP requests.
- Use `useTranslation` from `react-i18next` for all user-facing strings.
- Overlay pages must connect via SignalR to `/hubs/overlay` and implement reconnection logic.
- Keep overlay endpoints `[AllowAnonymous]` (they load as OBS Browser Sources without auth).

### General

- Test your changes with both English and Spanish language settings.
- Do not commit `.env` files, secrets, or credentials.
- Keep commits focused and descriptive.

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

Open an issue on GitHub with:
- A clear title and description.
- Steps to reproduce (if applicable).
- Expected vs actual behavior.

## License

By contributing, you agree that your contributions will be subject to the [Decatron Proprietary License](LICENSE).

---

Thank you for helping make Decatron better.
