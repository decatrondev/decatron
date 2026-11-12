# Personal page (`decatron.net/@name`)

Each channel can have its own page at `decatron.net/@name`: a short link with the streamer's socials, photo and style. It is free and not tied to any other module. This document covers sub-phase 5.1 (the base and the five templates: Scene, Badge, TV channel, Inventory, Poster) 5.2 (18+ content, domains and reports) 5.3 (layered scene) 5.4 (videos, photos and sounds), 5.5 (live, bot links and stats) and 5.10 (effects).

> **Open to the public since 2026-11-11** (`PersonalPages:PublicOpen=true`). With the key set to `false`, a published page is only visible to its owner, people with `control_total` on that channel and system owners, with a preview banner.

## Data model

Migrations: `Decatron.Data/Migrations/Add_Personal_Pages.sql`, `Add_Personal_Pages_Safety.sql` (5.2) and `Add_Personal_Page_Stats.sql` (5.5), idempotent.

| Table | Purpose |
|---|---|
| `personal_pages` | One page per channel (`channel_user_id` unique). `handle` unique, `draft` and `published` as JSON, `status` (`active`/`hidden`), `hidden_reason`, `needs_new_handle`, `forced_adult` (admin marked it 18+), `revision` (optimistic concurrency) |
| `personal_page_handle_history` | Old names that redirect to the page for 30 days |
| `personal_page_reserved_handles` | Names reserved by admins (added to the built-in list in `PersonalPageRules.BuiltInReserved`) |
| `personal_page_handle_appeals` | Appeals for a taken name: requester, message, status (`pending`, `rejected`, `transferred`, `withdrawn`), review |
| `personal_page_domains` | Admin domains: `adult` (forces 18+) or `blocked` (can't be linked). Added to the fixed lists |
| `personal_page_daily_stats` | Visits per page and day (5.5). Just the number: no IP, browser or who visited |
| `personal_page_click_stats` | Clicks per page, day and target (link id, `video:{id}` or `bot:{sr|tip|sprites}`) (5.5) |
| `personal_page_reports` | Reports: page, reporter, reason, details, link (id and URL at report time), status (`open`, `resolved`, `dismissed`) and resolution (`hidden`, `forced_adult`, `domain_blocked`). One open report per person and page |

There is no `tenant_id` yet: pages exist only on decatron.net. Tenant support will add the column with RLS and make the handle unique per tenant.

Content (`PersonalPageContent`, shared by every template): `displayName`, `bio`, `avatarUrl`, `template`, `theme`, `accent`, `font`, `links[]` (`id`, `kind`, `url`, `title`, `visible`, `size`, `adult`), `adult` (whole page 18+) and `scene` (5.3: `enabled`, `background` `color`/`pattern`/`media`, `bgColor`, `bgMedia`, `layers[]` with `id`, `kind` `photo`/`name`/`bio`/`sticker`/`text`, `x`, `y`, `width`, `height`, `visible`, `mediaUrl`, `text`, `font`, `color`, `size`, `align`), `videos[]` (`id`, `url`, `title`, `visible`), `photos[]` (`id`, `mediaUrl`, `caption`) and `sound` (`entryUrl`, `clickUrl`, `clickEnabled`, `volume`) from 5.4, `botLinks` (`songRequest`, `tips`, `sprites`) from 5.5, and `effects` (`particles`, `density`, `color`, `shine`, `cursor`, `entrance`) from 5.10. Switching templates never loses content. `template` is one of `scene`, `badge`, `channel`, `inventory`, `poster`; `size` (`normal`, `wide`, `big`) is used by Inventory (1×1, 2×1, 2×2 slots) and Poster (small, medium, large credits; if none is large, the first social is shown large).

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

### Layered scene (5.3)

- A `SceneWidth` × `SceneHeight` canvas (1080 × 1350, 4:5) scaled like an overlay. The order of `layers` is the drawing order. One `photo`, `name` and `bio` layer each; up to `SceneStickersMax` (20) stickers and `SceneTextsMax` (10) texts of up to 120 characters (technical caps, not plan limits).
- Files (stickers and background) must come from the channel's **media gallery** (`timer_media_files`, the same one Timer and Alerts use, with the per-plan storage quota): `PersonalPageService.GalleryAsync` builds public URL → type and `SceneErrors` requires it on save and publish (`layer_media:i`, `scene_bg_media`). Stickers: `image` or `gif`; background: also `video`.
- `SceneView` drops hidden layers and files later deleted from the gallery on display (the background falls back to the pattern); `MissingSceneMedia` feeds the panel notice (`missingMedia` in `GET /api/personal-page`).

### Videos, photos and sounds (5.4)

- `ParseVideo` recognizes YouTube (`youtube`, `youtube-short`), Twitch (`twitch-channel`, `twitch-video`, `twitch-clip`), Kick (`kick`) and TikTok (`tiktok`), `https` only, and returns the identifier. The URL is never embedded as is: the front builds the official player from the identifier (YouTube via `youtube-nocookie.com`; Twitch with `parent`). The player loads when «Play» is tapped.
- Up to `VideosMax` (10) videos and `PhotosMax` (12) photos, captions up to 80 characters (technical caps). Photos (`image`/`gif`) and sounds (`sound`) must come from the channel's gallery, like the scene.
- `HasSound`: an entry sound, or button sound turned on, with volume above 0. With sound, the page shows the «Enter» gate (the same as the 18+ one; an 18+ page gets a single gate). `MediaView` drops hidden videos and files deleted from the gallery on display; `MissingMedia` adds photos and sounds to the panel notice.

### Live, bot links and stats (5.5)

- Live: Twitch via `IStreamStatusService.IsLive` (what the bot already knows from EventSub) and Kick via `MultiviewStatusService.GetKickAsync` (cached public lookup, 1.5 s cap); linked rows of the same account are checked too. It goes in `live` in the public response; on failure the list is empty.
- Bot links: `AvailableBotLinksAsync` (Song Request on → `/sr/{channel}`, tips on → `/tip/{channel}`, at least one Sprite → `/sprites/{login}`) and `ChosenBotLinks` (only what the owner picked). They go in `botLinks` and the front adds them as custom links so all five templates draw them.
- Stats: `POST /api/public/personal-pages/{handle}/hit` `{ type: visit|click, target? }`, anonymous, always 204, rate limited per IP (`personal-page-hit`, 60 per minute). Doesn't count whoever manages the page, only counts while pages are public, one visit every 30 minutes per IP in memory (never stored) and per browser mark, and only real targets (`ValidClickTarget`). Counts with `INSERT … ON CONFLICT` (no races). `GET /api/personal-page/stats?days=7|30` (owner or full control) returns the daily series with zeros and clicks per target, and deletes anything older than 12 months.

### Effects (5.10)

- Closed lists in `PersonalPageRules`: `EffectParticles` (`none`, `sparkles`, `snow`, `confetti`, `bubbles`), `EffectDensities` (`low`, `medium`, `high`), `EffectColors` (`accent`, `white`), `EffectCursors` (`none`, `dots`, `sparkles`) and `EffectEntrances` (`none`, `fade`, `rise`, `cascade`). Everything off by default (`effects` null or `PersonalPageEffects()`). `Normalize` lowercases and fills defaults; `EffectErrors` returns `effects_particles`, `effects_density`, `effects_color`, `effects_cursor`, `effects_entrance`. It lives in the content JSON: no migration.
- Front (`PageEffects.tsx`): particles and the cursor trail are our own 2D canvas (no libraries), drawn inside the template root through the `backdrop` prop with `z-index:-1` in an isolated stacking context, so they sit above the page background and below the content; fixed to the viewport on the page and sized to the preview in the panel. Fewer particles on small screens, capped at 160, paused when the tab is hidden or the canvas is off screen. The trail only runs with a fine pointer and stops drawing when the mouse is still. Shine and the entrance are CSS on each template's surfaces (`FX_SURFACES`); cascade sets a delay per surface.
- With `prefers-reduced-motion: reduce` there are no particles, trail or shine, and every entrance becomes a 150 ms fade. Visitors get a «Pause effects» button (next to mute) when there are particles or a trail, remembered in `localStorage` (`decatron:pp-fx-paused`). The panel preview has a «Reduce motion» button (`reducedMotion` prop) and the template thumbnails use `noEffects`.

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
- Effects: `PageEffects.tsx` (particles, trail, pause button and CSS for shine and entrances) and the Effects card in Appearance.
- Live and stats: `LiveStrip.tsx` (strip in all five templates; «ON AIR» light in TV channel), `StatsTab.tsx` (Stats tab with a single-series chart and table view) and the «Bot links» card in Socials and links.
- Media: `MediaBlocks.tsx` (videos and photos in all five templates, with each template's colors via `--mb-*` variables), `MediaTab.tsx` (Media tab), `PageSound.tsx` (sounds and mute button) and `EntryGate` in `AgeGate.tsx`.
- Layered scene: `SceneCanvas.tsx` (canvas with percentages and `cqw` units, same component on the page and in the editor) and `SceneTab.tsx` (Scene tab with `OverlayCanvasEditor` and `MediaSelector` in `galleryOnly` mode).
- Age gate and 18+ link notice: `AgeGate.tsx` (an 18+ page isn't drawn until confirmed; on a regular page, `TemplateRenderer` covers the title of custom 18+ links and asks for confirmation when tapped, for all five templates). Reporting: `ReportBar.tsx`, at the bottom, hidden for the owner.
- Admin: `/admin/paginas` (Reports, Appeals, Pages, Domains and Reserved).
- Texts: `public/locales/{es,en}/personal-page.json`; docs `docs-personal-page.json`.

## Share preview

`PersonalPageSharePageController` serves `/@{handle}` with Open Graph tags when pages are open and the page is published and active; otherwise generic tags. An 18+ page gets a neutral preview (only `@name`, no photo or bio) with `robots: noindex`. It needs an nginx `location` for `/@…` pointing to the backend (same pattern as the tournament share preview).

## Configuration

| Key | Default | Description |
|---|---|---|
| `PersonalPages:PublicOpen` | `false` (in production `true` since 2026-11-11, in `appsettings.Secrets.json`) | Opens pages to the public |
| `PersonalPages:PublicAssetsPath` | `/var/www/html/decatron/personal-page-assets` | Folder for uploaded photos (must be writable by the backend user) |

## Tests

`Decatron.Tests/PersonalPageTests.cs`: pure rules (name, cooldown, redirect, URLs per platform, avatar, content errors, accent) and database tests against `decatron_schema` (first come, unique constraint, draft/publish/discard, cooldown and redirect, reclaiming an old name, reserved names, appeal transfer, reject/withdraw, hiding). Sub-phase 5.2: domains and subdomains, domain normalization, protected domains, shorteners, blocked domains, forced 18+, public view, and in the database: saving with admin domains, report rules and daily limit, hiding from a report, forced 18+ that sticks, and blocking the domain of a reported link. Sub-phase 5.3: valid scene, layer errors with index, gallery-only files, caps, public view without hidden layers or deleted files, and in the database: the channel gallery and another channel's files rejected. Sub-phase 5.4: video links recognized and rejected, video, photo and sound errors, caps, when there's sound, and public view without hidden videos or deleted files. Sub-phase 5.5: valid click targets, chosen bot links, and in the database: daily counts with zeros, clicks per target, deletion past 12 months and bot links only for active modules. Sub-phase 5.10: effects off by default, only closed-list values, normalization with defaults and effects kept in the public view.
