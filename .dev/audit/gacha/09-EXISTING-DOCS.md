# 09 - Existing Documentation: GachaVerse

**Created:** 2026-04-04
**Project:** GachaVerse Migration
**Purpose:** Catalog all existing documentation and identify gaps

---

## Overview

GachaVerse includes a substantial documentation set covering installation, configuration, architecture, and usage. This document catalogs all found documentation, assesses coverage, and identifies gaps relevant to the migration.

**Total documentation files found:** 18+
**Estimated coverage:** ~70% of implemented features

---

## Primary Documentation (/docs/)

Eight documentation files found in the `/docs/` directory:

### INSTALLATION.md (~580 lines)

Complete setup guide covering:
- Node.js requirements and installation
- MySQL database setup and schema import
- PostgreSQL database setup and schema import
- Environment variable configuration
- First-run instructions
- Dependency installation (`npm install`)
- Development vs production modes

### CONFIGURATION.md (~516 lines)

Environment variable reference covering:
- Database connection settings (MySQL and PostgreSQL)
- Session configuration
- Twitch API credentials
- Bot account settings
- Application port and host
- Debug/logging options

### ARCHITECTURE.md (~793 lines)

System architecture documentation with:
- Mermaid diagrams showing component relationships
- Request/response flow diagrams
- Database schema overview
- Module dependency graph
- Technology stack description
- Directory structure explanation

### API.md (~411 lines)

REST API reference covering:
- All documented endpoints with methods and URLs
- Request/response body formats
- WebSocket event definitions (Socket.IO)
- Error code reference table
- Authentication requirements per endpoint

### COMMANDS.md (~444 lines)

Bot command reference covering:
- All chat commands with syntax
- Command descriptions and examples
- Cooldown values per command
- Permission requirements
- Alias information

### TWITCH_INTEGRATION.md (~339 lines)

Twitch integration details covering:
- Dual-token system explanation (bot token + user token)
- OAuth2 flow walkthrough
- Token refresh mechanism
- IRC connection handling
- EventSub/webhook integration

### DEPLOYMENT.md (~539 lines)

Deployment guide covering:
- PM2 process manager setup
- Docker containerization
- Nginx reverse proxy configuration
- SSL/TLS certificate setup
- Monitoring and health checks
- Backup procedures

### CONTRIBUTING.md (~414 lines)

Contribution guide covering:
- Git workflow (branching, commits, PRs)
- Code style guidelines
- Project structure overview
- Development environment setup
- Testing instructions

---

## Root-Level Documentation

### README.md

Project overview including:
- Project description with badges
- Quick start instructions
- Feature list
- Technology stack
- Roadmap for v1.1 and v2.0
- License information

### MIGRACION_POSTGRESQL.md (~242 lines)

Migration guide from MySQL to PostgreSQL:
- Step-by-step migration process
- Schema differences between MySQL and PostgreSQL
- Data type mapping
- Trigger migration
- Testing post-migration

---

## Database Schemas

### schema.sql

Original MySQL schema definition:
- Table definitions for all entities
- Index definitions
- Foreign key constraints
- Default data inserts

### schema_postgresql.sql

PostgreSQL schema definition:
- Migrated table definitions
- PostgreSQL-specific data types
- Trigger functions
- Sequence definitions
- **WARNING:** Contains hardcoded bot tokens in seed data (lines 237-265) — see `06-SECURITY.md` finding C-2

---

## Guide Views (/views/)

Six EJS view templates serving as interactive in-app guides:

| View File | Topic | Description |
|-----------|-------|-------------|
| `guide-items` | Item Management | How to create, edit, and manage gacha items |
| `guide-restrictions` | Restrictions | How to set up pull restrictions per item |
| `guide-preferences` | Preferences | How to configure user/global preferences |
| `guide-rarity` | Rarity Tiers | How to define and configure rarity levels |
| `guide-probabilities` | Probabilities | How to set and tune pull probabilities |
| `guide-banners` | Banners | How to create limited-time banners |

These views are rendered server-side and accessible from the admin interface. They provide contextual help for each configuration section.

---

## Coverage Assessment

### Documented Features (~70%)

| Feature | Documentation Status |
|---------|---------------------|
| Installation & Setup | Fully documented |
| Configuration | Fully documented |
| System Architecture | Fully documented |
| REST API Endpoints | Documented (some gaps) |
| Bot Commands | Fully documented |
| Twitch Integration | Fully documented |
| Deployment | Fully documented |
| Contributing/Code Style | Fully documented |
| MySQL to PostgreSQL Migration | Documented |
| Item Management | Documented (in-app guide) |
| Restriction System | Documented (in-app guide) |
| Preference System | Partially documented (guide view only) |
| Rarity Configuration | Documented (in-app guide) |
| Probability System | Documented (in-app guide) |
| Banner System | Documented (in-app guide) |

### Documentation Gaps (~30%)

| Missing Documentation | Impact | Notes |
|-----------------------|--------|-------|
| **Decabanner system** | HIGH | Completely undocumented. No reference in any doc file. |
| **Overlay system** | HIGH | Barely documented. No setup instructions, no configuration reference, no OBS integration guide. |
| **Preference system details** | MEDIUM | Only has in-app guide view. No documentation of favorite/hidden/priority mechanics or priority resolution order. |
| **Admin whitelist** | MEDIUM | Not mentioned in any documentation. Undiscoverable feature. |
| **Troubleshooting guide** | MEDIUM | No common issues, error resolution, or FAQ document. |
| **Performance tuning** | LOW | No guidance on database optimization, caching, or scaling. |
| **Security documentation** | HIGH | No security guide, no hardening instructions, no threat model. |
| **Testing documentation** | HIGH | No test guide. `npm test` returns an error — tests appear non-functional. |
| **Changelog** | LOW | No version history or release notes. |
| **Release procedures** | LOW | No documented release process or versioning strategy. |
| **Frontend/UI documentation** | MEDIUM | No documentation of the web interface, admin panel, or collection viewer UI. |

---

## Documentation Quality Assessment

### Strengths

- Comprehensive installation and deployment guides
- Well-structured architecture document with diagrams
- In-app guide views provide contextual help
- API documentation covers most endpoints
- Good command reference with examples

### Weaknesses

- Several major features completely undocumented
- No troubleshooting or FAQ resources
- No security documentation whatsoever
- Testing infrastructure appears broken
- No changelog tracking project evolution
- Documentation may be outdated in some areas (no last-updated dates)

---

## Relevance to Migration

### Use as Reference

These documents serve as the primary reference for understanding GachaVerse's intended behavior during migration. Key documents:

1. **ARCHITECTURE.md** — Understanding component relationships and data flow
2. **API.md** — Mapping endpoints to new GachaController
3. **COMMANDS.md** — Porting bot commands with correct behavior
4. **schema_postgresql.sql** — Source schema for EF Core model creation
5. **Guide views** — Understanding feature behavior for service implementation

### New Documentation (Phase 8)

New documentation will be created as part of the migration Phase 8:
- Streamer guide (replaces in-app guide views)
- Viewer guide (new)
- Updated API reference (auto-generated from Swagger)
- Overlay setup guide (filling current gap)
- All documentation in ES/EN/PT (i18n)

The new documentation will live within the Decatron documentation structure and will not carry over gaps from the original documentation set.
