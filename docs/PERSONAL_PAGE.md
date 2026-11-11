# Personal page (`decatron.net/@name`)

Each channel can have its own page at `decatron.net/@name`: a short link with the streamer's socials, photo and style. It is free and not tied to any other module. This document covers sub-phase 5.1: the base and the five templates (Scene, Badge, TV channel, Inventory, Poster).

> **Not open to the public yet.** While `PersonalPages:PublicOpen` is `false` (the default), a published page is only visible to its owner, people with `control_total` on that channel and system owners, with a preview banner. It opens once 18+ protections and reporting (sub-phase 5.2) are done.

## Data model

Migration: `Decatron.Data/Migrations/Add_Personal_Pages.sql` (idempotent).

| Table | Purpose |
|---|---|
| `personal_pages` | One page per channel (`channel_user_id` unique). `handle` unique, `draft` and `published` as JSON, `status` (`active`/`hidden`), `hidden_reason`, `needs_new_handle`, `revision` (optimistic concurrency) |
| `personal_page_handle_history` | Old names that redirect to the page for 30 days |
| `personal_page_reserved_handles` | Names reserved by admins (added to the built-in list in `PersonalPageRules.BuiltInReserved`) |
| `personal_page_handle_appeals` | Appeals for a taken name: requester, message, status (`pending`, `rejected`, `transferred`, `withdrawn`), review |

There is no `tenant_id` yet: pages exist only on decatron.net. Tenant support will add the column with RLS and make the handle unique per tenant.

Content (`PersonalPageContent`, shared by every template): `displayName`, `bio`, `avatarUrl`, `template`, `theme`, `accent`, `font`, `links[]` (`id`, `kind`, `url`, `title`, `visible`, `size`). Switching templates never loses content. `template` is one of `scene`, `badge`, `channel`, `inventory`, `poster`; `size` (`normal`, `wide`, `big`) is used by Inventory (1×1, 2×1, 2×2 slots) and Poster (small, medium, large credits; if none is large, the first social is shown large).

## Rules (`Decatron.Core/Helpers/PersonalPageRules.cs`)

- Handle: 3–25 characters, lowercase letters, numbers, `-` and `_`, not at the start or end. Built-in reserved words plus the admin list. `pagina-<number>` is reserved for temporary names.
- First come, first served. A name can be changed once every 30 days; the old one redirects for 30 days and nobody else can take it meanwhile.
- Display name up to 50 characters, bio up to 300, link title up to 60, URL up to 500, up to 100 links (technical cap, not a plan limit).
- Links are `https` only, without credentials or custom ports. Platform links must use that platform's hosts (Twitch, Kick, YouTube, TikTok, Instagram, X, Discord, Facebook, Threads, Bluesky, OnlyFans, Fansly). OnlyFans and Fansly are flagged as adult.
- Photos: own uploads (re-encoded to WEBP, max 512 px, metadata stripped, 10 MB input) or the channel photo from the Twitch/Kick CDN.
- Accent color from the photo: `PersonalPageAccent.FromPixels` (pure function).
- Publishing requires a display name.

## API

Panel (authenticated, channel owner or `control_total`; permission section `personal_page`; only on decatron.net):

| Method | Route | Description |
|---|---|---|
| GET | `/api/personal-page` | Page, suggested name, channel, platforms, fonts, limits, `publicOpen` |
| GET | `/api/personal-page/handle-check?handle=` | Shape and availability (`length`, `chars`, `edge`, `reserved`, `taken`, `redirecting`) |
| POST | `/api/personal-page` | Create the page `{ handle }` |
| PUT | `/api/personal-page/draft` | Save the draft `{ content, revision }` |
| POST | `/api/personal-page/publish` | Publish the draft `{ revision }` |
| POST | `/api/personal-page/discard` | Draft back to published `{ revision }` |
| PUT | `/api/personal-page/handle` | Change the name `{ handle, revision }` |
| POST | `/api/personal-page/avatar` | Upload the photo (multipart `file`, `revision`), returns `suggestedAccent` |
| POST | `/api/personal-page/accent-from-photo` | Accent color from the current photo |
| GET/POST | `/api/personal-page/appeals` | My appeals / send an appeal `{ handle, message }` |
| POST | `/api/personal-page/appeals/{id}/withdraw` | Withdraw a pending appeal |

Public (anonymous): `GET /api/public/personal-pages/{handle}` (published page, or `{ redirect }` for an old name; `not_found`, `not_open`, `hidden`, `not_published`) and `GET /api/public/personal-pages/assets/{pageId}/{file}`.

Admin (system owner): `GET /api/admin/personal-pages`, `POST /api/admin/personal-pages/{id}/visibility`, `GET|POST /api/admin/personal-pages/reserved`, `DELETE /api/admin/personal-pages/reserved/{handle}`, `GET /api/admin/personal-pages/appeals`, `POST .../appeals/{id}/reject`, `POST .../appeals/{id}/transfer`.

Errors are stable codes (`{ code, details }`), never internal messages. A stale `revision` returns `409 stale_revision`.

Accepting an appeal (`transfer`) gives the name to the requester (creating their page if needed); the current owner moves to `pagina-<id>` with `needs_new_handle = true` and can pick a new name without waiting 30 days. Other pending appeals for that name are rejected.

## Front end

- Panel: `/mi-pagina` (`ClientApp/src/pages/personal-page/`), tabs Guide, Profile, Socials and links, Appearance, Name, with a phone/desktop preview.
- Public page: `/@name` (`PersonalPagePublic.tsx`). React Router does not support `@:param`, so the route is `/:atHandle` and the component requires the `@`.
- Templates: `SceneTemplate.tsx`, `BadgeTemplate.tsx` (QR with the `qrcode` package), `ChannelTemplate.tsx`, `InventoryTemplate.tsx`, `PosterTemplate.tsx`, chosen by `TemplateRenderer.tsx`. All keep the mockup composition on desktop, centered and larger, using container queries (the panel preview renders the phone layout). Mockups: `.dev/plans/pagina-personal/maquetas/` (not in git).
- Admin: `/admin/paginas`.
- Texts: `public/locales/{es,en}/personal-page.json`; docs `docs-personal-page.json`.

## Share preview

`PersonalPageSharePageController` serves `/@{handle}` with Open Graph tags when pages are open and the page is published and active; otherwise generic tags. It needs an nginx `location` for `/@…` pointing to the backend (same pattern as the tournament share preview).

## Configuration

| Key | Default | Description |
|---|---|---|
| `PersonalPages:PublicOpen` | `false` | Opens pages to the public (sub-phase 5.2) |
| `PersonalPages:PublicAssetsPath` | `/var/www/html/decatron/personal-page-assets` | Folder for uploaded photos (must be writable by the backend user) |

## Tests

`Decatron.Tests/PersonalPageTests.cs`: pure rules (name, cooldown, redirect, URLs per platform, avatar, content errors, accent) and database tests against `decatron_schema` (first come, unique constraint, draft/publish/discard, cooldown and redirect, reclaiming an old name, reserved names, appeal transfer, reject/withdraw, hiding).
