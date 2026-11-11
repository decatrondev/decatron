# Personal page (`decatron.net/@name`)

Each channel can have its own page at `decatron.net/@name`: a short link with the streamer's socials, photo and style. It is free and not tied to any other module. This document covers sub-phase 5.1 (the base and the five templates: Scene, Badge, TV channel, Inventory, Poster) and 5.2 (18+ content, domains and reports).

> **Not open to the public yet.** While `PersonalPages:PublicOpen` is `false` (the default), a published page is only visible to its owner, people with `control_total` on that channel and system owners, with a preview banner. The sub-phase 5.2 protections are in place; opening it only takes changing that key.

## Data model

Migrations: `Decatron.Data/Migrations/Add_Personal_Pages.sql` and `Add_Personal_Pages_Safety.sql` (5.2), both idempotent.

| Table | Purpose |
|---|---|
| `personal_pages` | One page per channel (`channel_user_id` unique). `handle` unique, `draft` and `published` as JSON, `status` (`active`/`hidden`), `hidden_reason`, `needs_new_handle`, `forced_adult` (admin marked it 18+), `revision` (optimistic concurrency) |
| `personal_page_handle_history` | Old names that redirect to the page for 30 days |
| `personal_page_reserved_handles` | Names reserved by admins (added to the built-in list in `PersonalPageRules.BuiltInReserved`) |
| `personal_page_handle_appeals` | Appeals for a taken name: requester, message, status (`pending`, `rejected`, `transferred`, `withdrawn`), review |
| `personal_page_domains` | Admin domains: `adult` (forces 18+) or `blocked` (can't be linked). Added to the fixed lists |
| `personal_page_reports` | Reports: page, reporter, reason, details, link (id and URL at report time), status (`open`, `resolved`, `dismissed`) and resolution (`hidden`, `forced_adult`, `domain_blocked`). One open report per person and page |

There is no `tenant_id` yet: pages exist only on decatron.net. Tenant support will add the column with RLS and make the handle unique per tenant.

Content (`PersonalPageContent`, shared by every template): `displayName`, `bio`, `avatarUrl`, `template`, `theme`, `accent`, `font`, `links[]` (`id`, `kind`, `url`, `title`, `visible`, `size`, `adult`), `adult` (whole page 18+). Switching templates never loses content. `template` is one of `scene`, `badge`, `channel`, `inventory`, `poster`; `size` (`normal`, `wide`, `big`) is used by Inventory (1×1, 2×1, 2×2 slots) and Poster (small, medium, large credits; if none is large, the first social is shown large).

## Rules (`Decatron.Core/Helpers/PersonalPageRules.cs`)

- Handle: 3–25 characters, lowercase letters, numbers, `-` and `_`, not at the start or end. Built-in reserved words plus the admin list. `pagina-<number>` is reserved for temporary names.
- First come, first served. A name can be changed once every 30 days; the old one redirects for 30 days and nobody else can take it meanwhile.
- Display name up to 50 characters, bio up to 300, link title up to 60, URL up to 500, up to 100 links (technical cap, not a plan limit).
- Links are `https` only, without credentials or custom ports. Platform links must use that platform's hosts (Twitch, Kick, YouTube, TikTok, Instagram, X, Discord, Facebook, Threads, Bluesky, OnlyFans, Fansly). OnlyFans and Fansly are flagged as adult.
- Photos: own uploads (re-encoded to WEBP, max 512 px, metadata stripped, 10 MB input) or the channel photo from the Twitch/Kick CDN.
- Accent color from the photo: `PersonalPageAccent.FromPixels` (pure function).
- Publishing requires a display name.

### 18+ content, domains and reports (5.2)

- `adult` on a link or the page is set by the owner. It is forced (can't be unmarked) for OnlyFans and Fansly, for the sites in `BuiltInAdultDomains` and for admin `adult` domains; the whole page is forced with `forced_adult`. `ApplyForced` applies it on save and `PublicView` again on display, because admin can add domains later.
- A domain matches itself and its subdomains (`DomainMatches`). `blocked` domains can't be saved (`link_blocked:i`) and links already saved to those sites stop showing. Link shorteners (`Shorteners`) aren't accepted in custom links (`link_shortener:i`).
- Admin can't add the hosts of the listed networks or decatron.net (`IsProtectedHost`).
- Reports: signed in only, never your own page, one open report per person and page, up to `ReportsPerDay` (10) per person in 24 hours, plus a per-IP limit (`personal-page-report`, 8 every 10 minutes). Reasons: `adult_unmarked`, `scam`, `impersonation`, `hate`, `copyright`, `other`.
- Admin actions on a report: `dismiss`, `hide` (hides the page with the note as reason and closes all its open reports), `force_adult` and `block_domain` (blocks the domain of the reported link). Nothing is hidden automatically.
- The visitor's age confirmation is a statement, not a verification: it's remembered in the browser (`localStorage`).

## API

Panel (authenticated, channel owner or `control_total`; permission section `personal_page`; only on decatron.net):

| Method | Route | Description |
|---|---|---|
| GET | `/api/personal-page` | Page, suggested name, channel, platforms, fonts, limits, `publicOpen` and `domains` (adult, blocked and shorteners, to flag links in the editor) |
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

Public (anonymous): `GET /api/public/personal-pages/{handle}` (published page with 18+ applied and blocked links removed, `adult`, `isOwner`, `reportReasons`; or `{ redirect }` for an old name; `not_found`, `not_open`, `hidden`, `not_published`; an 18+ page responds with `X-Robots-Tag: noindex`) and `GET /api/public/personal-pages/assets/{pageId}/{file}`.

Report (signed in): `POST /api/public/personal-pages/{handle}/report` `{ reason, detail?, linkId? }`.

Admin (system owner): `GET /api/admin/personal-pages`, `POST /api/admin/personal-pages/{id}/visibility`, `GET|POST /api/admin/personal-pages/reserved`, `DELETE /api/admin/personal-pages/reserved/{handle}`, `GET /api/admin/personal-pages/appeals`, `POST .../appeals/{id}/reject`, `POST .../appeals/{id}/transfer`, `POST /api/admin/personal-pages/{id}/forced-adult` `{ forced }`, `GET /api/admin/personal-pages/reports?status=`, `POST .../reports/{id}/resolve` `{ action, note }`, `GET|POST /api/admin/personal-pages/domains` `{ domain, kind, note }` and `DELETE .../domains/{domain}`.

Errors are stable codes (`{ code, details }`), never internal messages. A stale `revision` returns `409 stale_revision`.

Accepting an appeal (`transfer`) gives the name to the requester (creating their page if needed); the current owner moves to `pagina-<id>` with `needs_new_handle = true` and can pick a new name without waiting 30 days. Other pending appeals for that name are rejected.

## Front end

- Panel: `/mi-pagina` (`ClientApp/src/pages/personal-page/`), tabs Guide, Profile, Socials and links, Appearance, Name, with a phone/desktop preview.
- Public page: `/@name` (`PersonalPagePublic.tsx`). React Router does not support `@:param`, so the route is `/:atHandle` and the component requires the `@`.
- Templates: `SceneTemplate.tsx`, `BadgeTemplate.tsx` (QR with the `qrcode` package), `ChannelTemplate.tsx`, `InventoryTemplate.tsx`, `PosterTemplate.tsx`, chosen by `TemplateRenderer.tsx`. All keep the mockup composition on desktop, centered and larger, using container queries (the panel preview renders the phone layout). Mockups: `.dev/plans/pagina-personal/maquetas/` (not in git).
- Age gate and 18+ link notice: `AgeGate.tsx` (an 18+ page isn't drawn until confirmed; on a regular page, `TemplateRenderer` covers the title of custom 18+ links and asks for confirmation when tapped, for all five templates). Reporting: `ReportBar.tsx`, at the bottom, hidden for the owner.
- Admin: `/admin/paginas` (Reports, Appeals, Pages, Domains and Reserved).
- Texts: `public/locales/{es,en}/personal-page.json`; docs `docs-personal-page.json`.

## Share preview

`PersonalPageSharePageController` serves `/@{handle}` with Open Graph tags when pages are open and the page is published and active; otherwise generic tags. An 18+ page gets a neutral preview (only `@name`, no photo or bio) with `robots: noindex`. It needs an nginx `location` for `/@…` pointing to the backend (same pattern as the tournament share preview).

## Configuration

| Key | Default | Description |
|---|---|---|
| `PersonalPages:PublicOpen` | `false` | Opens pages to the public |
| `PersonalPages:PublicAssetsPath` | `/var/www/html/decatron/personal-page-assets` | Folder for uploaded photos (must be writable by the backend user) |

## Tests

`Decatron.Tests/PersonalPageTests.cs`: pure rules (name, cooldown, redirect, URLs per platform, avatar, content errors, accent) and database tests against `decatron_schema` (first come, unique constraint, draft/publish/discard, cooldown and redirect, reclaiming an old name, reserved names, appeal transfer, reject/withdraw, hiding). Sub-phase 5.2: domains and subdomains, domain normalization, protected domains, shorteners, blocked domains, forced 18+, public view, and in the database: saving with admin domains, report rules and daily limit, hiding from a report, forced 18+ that sticks, and blocking the domain of a reported link.
