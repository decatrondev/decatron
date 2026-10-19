# Decatron Platform (backend as a service) -- Architecture

This document describes the multi-tenant platform that sits next to the Decatron bot: a buyer gets an isolated space at `slug.decatron.top`, loads their own Twitch app, bot account, Discord bot and API keys, and their streamers sign in there. The bot at `decatron.net` is tenant **#1** and keeps working exactly as before.

Everything here comes from the code. The public launch is still being defined, and billing is built but off; only what already runs is described.

## 1. Tenants and isolation

- A **tenant** is a row in `tenants` (`slug`, `name`, `status`). Tenant #1 is the original bot; it reads its credentials from `appsettings` and never touches the per-tenant stores.
- **Which tenant is this request?** `TenantMiddleware` resolves it by **Host** first (`slug.decatron.top`, via `ITenantResolver.ByHost`) and then by the signed-in user. The Host wins: a session from another tenant does not change the tenant of that subdomain. Services that are not request-scoped read it from `TenantAmbient.Current` (defaults to 1).
- **Isolation in the database.** Every table that carries `tenant_id` has row-level security (`tenant_isolation` policy on `app_tenant_id()`), and the application connects as `decatron_app`, a role without superuser rights. A connection without tenant context sees nothing and cannot insert. Settings: `Platform:TenantContext:Mode` (`strict`) and `Platform:TenantContext:Rls` (`context`).
- **One account row per tenant.** With `Platform:IdentityPerTenant` on, the same person has a separate `users` row, with its own tokens, in each tenant.
- **Reserved subdomains** (`www`, `api`, `admin`, `mail`, `panel`, `login`, `prueba`, `decatron`, `twitch`, `kick`, ...) cannot be registered; the list lives in `PlatformSlug`. Slugs are 3-30 characters of `a-z0-9-`, with no leading, trailing or double hyphen.

## 2. Credentials per tenant

A tenant brings its own: Twitch application, Twitch bot account, Discord bot token and optional API keys (AI, Deepgram, Fish Audio).

- **Encryption.** Secrets are stored with `SecretVault` (`ENC2`, AES-GCM). Each tenant has its own data key, wrapped by a master key kept in a file outside the repository (`Platform:MasterKeyPath`). Secrets are write-only: the API returns "configured, last 4 characters", never the value.
- **Fail closed.** `ICredentialProvider` returns tenant #1's values only for tenant #1. Any other tenant without credentials gets an error, never the credentials of #1.
- **Audit.** Every read and write is recorded in `credential_access_log` (who, what, when; never the secret).
- **What the platform fixes, the buyer does not choose:** the redirect URL (`https://slug.decatron.top/api/auth/callback`) and the Twitch scopes.
- **Per-tenant runtime:** EventSub conduit and shards (`TenantEventSubHub`, `Platform:EventSub:TenantShardCount`), Discord gateway (`DiscordTenantGateway`, capped by `Platform:Discord:MaxGateways`, 20 by default), message sending with the tenant's own bot, and background tasks run once per tenant (`TenantTaskRunner`).

## 3. Plans and limits

Capabilities are rows, not code. The catalog (`capabilities`) has four groups: `module.*` (on/off), `quota.*` (numeric cap), `byo.*` (may load an own key) and `feature.*`. Plans are `internal` (tenant #1, no caps), `sandbox`, `semilla`, `creator`, `pro`, `studio` and `exclusivo`.

- **Precedence:** per-tenant override, then add-on, then plan, then default (`IEntitlements`).
- **Sandbox.** A new tenant starts on `sandbox` for 7 days.
- **Lifecycle.** `TenantLifecycle` (every 60 s by default) pauses the EventSub connection and Discord gateway of a tenant that is not operational (suspended, cancelled, sandbox expired, no subscription) and resumes them on its own. It logs `tenant.purge.due` for tenants past the retention period (`Platform:Lifecycle:PurgeAfterDays`, 30 by default); it never deletes by itself.
- **Enforcement.** `[RequiresModule("module.x")]` on controllers, plan filters on chat commands and background tasks, and counters for commands, timers, storage, e-mails and monthly chat messages (the chat counter only measures).
- **What the panel shows.** `GET /api/platform/my-modules` (any signed-in session, tenant from the Host) lists the modules the plan includes. The streamer panel hides the menu entries of modules the plan lacks, marks their cards as "not included in your plan" and shows a short notice instead of the page if someone opens its address. It is informational only: the server still answers 403 `module_not_included`. If the list cannot be loaded, everything is shown.
- **Brand of the streamer panel.** On a tenant subdomain the side menu, the browser tab and the dashboard greeting use the project's name (`GET /api/platform/tenant-info`), and the overlay and tips links the panel shows use that subdomain instead of `decatron.net`.
- **One streamer in two tenants.** The same Twitch account can have a channel in Decatron (tenant 1) and in the tenant of its own project. The bot that serves it is the one of the tenant other than 1 where the streamer has the bot enabled; while that bot is off, Decatron keeps serving the channel. Decatron stops subscribing the channel and ignores its events as soon as the other tenant's bot is on, so commands are never answered twice, and it takes the channel back on its own when that bot is turned off (the list refreshes every minute).
- **Streamer tokens.** The background renewal of Twitch user tokens (every 30 minutes) runs once per tenant, each with its own Twitch app, so a streamer of any tenant keeps a valid token. Commands that act on the channel (`!g`, `!game`, `!title`) need it.
- **Own keys.** AI, voice and translation run on the tenant's own keys. Without a key the feature is off; Decatron's keys are never used for another tenant. A provider is enabled when the plan includes at least one of its capabilities (`byo.ai` or `byo.translate` for AI, `byo.stt` or `byo.tts` for Deepgram, `byo.tts` for Fish Audio); the buyer panel shows a provider the plan does not include as "not in your plan", and the server refuses to save its key (`byo_not_in_plan`).

- **Email.** There are two separate mail paths. Platform mail (sign-in links, team invitations, waitlist) is Decatron's own and goes out through Resend or through Decatron's own mail server (SMTP), chosen from the admin panel under Email → Provider (`platform_mail_settings`; the SMTP password lives in `appsettings.Secrets.json`, never in the database; if the own server fails on a real email it is retried through Resend). Email a tenant sends to its own users must use the tenant's own Resend key (`byo.email`); it never goes through Decatron's key and there is no email quota.
- Export and purge of a tenant are owner-only tools (`GET .../export`, `POST .../purge`). A purge asks for the slug as confirmation and only works on a tenant that is not operational.

### Prices and billing

Billing is built and switched off: nobody can be charged until `Platform:Billing:CheckoutEnabled` is turned on (reminders have their own switch, `Platform:Billing:RemindersEnabled`). The public price list is `decatron.top/planes`; the amounts live in the database (`plan_prices`, `addon_prices`), never in the page or in this document, and `GET /api/platform/plans` serves them.

- **What is for sale.** Four paid plans (`semilla`, `creator`, `pro`, `studio`); `exclusivo` is quoted by hand. Prices are in US dollars and **include IGV in Peru**; outside Peru the price is the same with no IGV (export of services). Periods of 1, 3, 6, 9 or 12 months, each with its own price per plan (longer periods carry a discount). **Single modules** can be added to a plan that does not include them; a plan plus its modules never costs more than the next plan (the total is capped and the quote says so).
- **How it is charged.** Culqi, in soles, at the fixed exchange rate Decatron sets in `finance_settings.pen_per_usd` (not the market rate; card and Yape). The buyer opens `/panel/plan`, picks plan, period and modules and fills in the billing data (name, country, document, e-mail; invoice needs a RUC). The server computes the quote (`PlatformPricing`: base, IGV, total in dollars and soles, end date); the browser only shows it and sends the card token.
- **Checkout.** Owner only, with the 2FA step-up if enabled. It stores a pending payment (`tenant_payments`) that remembers what was bought, charges the token and, on success, confirms in **one transaction**: it sets the plan and period, creates the modules with the same end date and clears the grace period. Confirming twice does nothing. Scope today: a new purchase (sandbox, no end date, expired or in grace) or a renewal of the same plan in the 7 days before it expires; moving up a plan or adding modules in the middle of a period answers `change_not_available`. A charge with no id from the provider is logged for manual review (`tenant.billing.review`).
- **Changes in the middle of a period.** While a plan is active the buyer can move up to a higher plan or add modules: only the difference is charged, pro-rated by the days left (`PlatformPricing.UpgradeCharge`), the period and the end date do not change and new modules end on that date. Moving to a lower plan or changing the period is refused (`downgrade_not_available`, `period_locked`): the lower plan is bought when the period ends or during grace, and nothing is refunded. In the last 7 days before the end date the same plan is a normal renewal and the period can be changed.
- **Automatic billing.** Off by default (`Platform:Billing:AutoRenewEnabled`). The owner ticks "Renew automatically" when paying: the card is saved with Culqi (customer + card; Culqi requires address, city and phone, which are sent to it and not stored here) and only the provider ids plus the last 4 digits and brand are kept in `tenant_billing_profile` (`pay_mode='auto'`). `AutoRenewal` (every 30 minutes from `TenantLifecycle`) charges the same plan, period and modules from the saved card when 3 days or less remain (or the plan already expired and is still in grace), marked as a recurring charge, at the fixed exchange rate. Up to 3 attempts per end date (day 0, +2 and +4); every attempt is written to `tenant_autopay_attempts` **before** charging, so a restart in the middle of a charge never repeats it (it is left for manual review, `tenant.billing.review`). Each failed attempt e-mails the owner; after the third the tenant goes back to manual, the card is deleted at the provider and the owner is told. Cancelling is immediate (`POST .../billing/auto/disable`): the card is deleted, the plan runs to its end date and the paid period is not refunded. Owners on automatic billing do not get the "renew" reminders.
- **Culqi notices (webhooks).** A safety net, not a requirement: payment is already confirmed at the moment of the charge. Culqi does not document how it signs its notices, so **nothing in a notice is trusted**: `PlatformWebhooks` only pulls the charge ids (`chr_live_…`/`chr_test_…`) out of the body and asks Culqi for each charge with the secret key (the key is picked from the id, so a test notice works while live is active). Only charges whose `metadata.platform` is `decatron-platform` are acted on (the same Culqi account also charges DecaCoins, credits and Supporters with their own flows), and the amount must match the ledger. From that answer: an **authorized charge whose payment is still pending or failed** (a cut between charging and confirming) is confirmed, idempotently; a **charge refunded in Culqi** marks the payment `refunded` (out of the owner's P&L) and logs `tenant.billing.webhook.refunded` so the receipt gets credit-noted by hand. The endpoint is `POST /api/platform/webhooks/culqi/{secret}`; with no `Platform:Billing:CulqiWebhookSecret` (24 characters or more), or a different one, it answers 404 as if it did not exist. Every notice is stored for 30 days in `platform_webhook_events` with what was done. Register the URL in CulqiPanel → Events → Webhook.
- **Grace period.** When a paid plan passes its end date, `TenantGrace` sets `grace_until` (`Platform:Billing:GraceDays`, 5 by default) and the status `past_due`. During grace the bot keeps working and the panel shows a fixed notice at the top; when it ends the tenant is paused like any other that is not operational. Data is kept 30 days and paying reactivates. Internal plans, sandbox and subscriptions with no end date (the pilot) are never touched.
- **Reminders.** At 7, 3 and 1 days before the end date and when grace starts, an e-mail with a link to the panel. One per threshold and subscription (`tenant_billing_reminders`), with their own daily cap (`Platform:Billing:ReminderMaxPerDay`, 100) counted apart from the waiting list (`platform_billing_emails`). Off by default.
- **Receipts.** Each paid payment gets a SUNAT receipt through DecatronAPI, with the same fiscal rule and issuing company as credits and DecaCoins (boleta or factura by document). Test payments are never invoiced. The buyer downloads PDF or XML from the history. Subscriptions appear in the owner's finance screen as their own source.
- **No refunds.** The 7-day trial exists so the buyer decides before paying; a duplicate or wrong charge is fixed by hand.
- **Ledger.** `tenant_payments` is an accounting ledger: it is never deleted, not even when a tenant is purged. The only read across tenants is the function `platform_payments_all`, used by the owner's finance screen.
- **Clips.** `!so` and `!clip` of a tenant other than #1 do not download the clip to the server (the shared clip archive belongs to tenant #1).

## 4. The buyer account

The buyer is independent of Twitch: they are identified by e-mail and are an `owner` in `tenant_members`.

1. **Sign-up** at `decatron.top/registro`: e-mail, project name and subdomain, plus a Turnstile challenge. By default sign-up is **by approval** (`Platform:SignupMode`): only e-mails the platform owner approved can get a link. A request from any other e-mail gets the same answer as a normal one but sends nothing and spends no e-mail quota, so nobody can tell who is approved; approval is checked again when the link is confirmed, so removing it stops a pending sign-up. Approving (from the waiting list or by hand, in the admin panel) sends no e-mail and creates nothing. Set the mode to `open` to let anyone sign up. Limits: 5 requests per IP and 3 per e-mail per day; the e-mail quota is shared with the waiting list (`Platform:WaitlistMaxEmailsPerDay`, 40 by default).
2. A one-use link, valid 30 minutes, is e-mailed. The tenant is created **only when the link is confirmed**, in one transaction: tenant, owner account, membership and sandbox subscription. The answer to a request never reveals whether an e-mail exists.
3. **Signing in again:** `slug.decatron.top/panel/login` sends a 15-minute one-use link, valid only on that host.
4. **Session:** an 8-hour JWT with the claim `tnt` (the tenant) and `scope=buyer`. `TenantMiddleware` answers 403 if the claim does not match the Host, and a buyer session can only open `/api/platform/`, `/api/auth/`, `/api/brand` and `/api/design/tokens`, never the streamer screens. It is delivered through the 60-second exchange code (`/api/auth/exchange`), not in the URL.
5. **Panel** (`slug.decatron.top/panel`): the buyer loads the Twitch app, links the bot, reopens the EventSub connection, optionally adds a Discord bot and own keys. The **Plan** tab (`/panel/plan`) shows the plan, expiry and payment history, and is where the owner buys or renews; administrators see it read-only. A grace or expiry notice stays fixed at the top of every tab. Every action re-checks in the database that the caller is still the owner (or, for the read routes, an administrator).

### Team (administrators)

The owner can invite administrators by e-mail (tab **Team** in the panel). Rules:

- **What an administrator can do:** sign in to the panel in **read-only** mode (state of the connections, plan, usage and permissions) and reopen the EventSub connection. They cannot touch credentials (Twitch app, bot, Discord, own keys), the 2FA or the team, and they never see credential hints (Client ID, last characters, account names): only "set up / not set up". The server picks the filter per route: `RequireBuyerOwner` for everything sensitive (a new action is protected by default) and `RequireBuyerMember` (owner or admin) only for the read routes and the EventSub restart.
- **Invitation:** an e-mail with a one-use link valid 7 days. Opening it (confirmed with a `POST`, so an e-mail preview does not spend it) creates the invitee's buyer account in that tenant (`users`, `auth_provider='email'`) and a `tenant_members` row with role `admin`, and signs them in through the 60-second exchange code. The link only works on the tenant's own subdomain. Only the token hash is stored (`tenant_invitations`, row-level security).
- **Limit:** `quota.admins` counts owner + admins + live invitations, checked when inviting **and again when accepting** (if the plan went down meanwhile, the invitation is not accepted). Fails closed. On a plan with no extra seat (sandbox, Seed) the form is disabled with "not included in your plan". Abuse caps: 5 pending invitations and 10 invitations per day per tenant (cancelled ones count); invitations use the shared e-mail quota (`Platform:WaitlistMaxEmailsPerDay`) and do not depend on `Platform:SignupMode`. A project that is not operational cannot invite or accept.
- **Removing:** the owner can remove an admin or cancel an invitation. The role is read from the database on every call (never from the token), so removal closes access immediately; the admin's account is left inactive. Inviting and removing need the 2FA step-up if the owner enabled it. Every invitation, acceptance, cancellation and removal goes to `credential_access_log` (provider `team`, no e-mail addresses).
- **Streamers** who signed in with Twitch (`viewer`) are listed read-only in a separate tab; they count toward `quota.channels`, not `quota.admins`.
- Out of scope: transferring ownership and intermediate roles.

### Transparency

The panel shows what the buyer needs to decide with open eyes (`GET /api/platform/buyer/transparency`):

- the plan, its modules (included or not), limits with current usage and which own keys apply;
- every Twitch permission the platform requests, split into streamers and the bot account, each with its reason and the module that needs it. The single source is `TwitchScopeCatalog`; a unit test fails if a requested scope has no entry.
- `channel_editor` (a retired API v5 scope that makes new Twitch apps fail with "authorization data could not be loaded") is removed for every tenant except #1.

### Streamer sign-in on the tenant subdomain

`slug.decatron.top/login` shows the tenant's name as the brand, only the Twitch button (Kick and Discord use Decatron's own apps, not the tenant's), and the list of permissions. It is fed by the public `GET /api/platform/tenant-info`. The login always uses the tenant's own Twitch application; if the tenant has none, or is not active, the page says so instead of redirecting.

## 5. Two-step verification (required for the owner)

- **Method:** TOTP (RFC 6238, SHA-1, 6 digits, 30 s, one step of clock drift) plus 8 one-use recovery codes. A code is accepted once (the last used step is stored).
- **Storage:** the secret is encrypted with `SecretVault`; recovery codes are stored only as hashes; tables `tenant_buyer_mfa` and `tenant_buyer_recovery_codes` have row-level security. Every event goes to `credential_access_log` (`mfa_setup`, `mfa_enable`, `mfa_ok`, `mfa_fail`, `mfa_locked`, `mfa_recovery`, `mfa_codes`, `mfa_disable`).
- **Lockout:** 5 failures in a row lock the account for 15 minutes.
- **Required for the owner.** While `Platform:RequireOwnerMfa` is on (default), an owner without 2FA gets `403 mfa_required` on every buyer route except `GET /buyer/me` (which reports `mfa.required`) and the 2FA routes themselves; the panel then shows only the activation screen. Administrators are not asked for it (they are read-only). Turning 2FA off is allowed but locks the panel again until it is re-enabled.
- **Security notices by email** to the owner when 2FA is turned off and when a recovery code is used (best effort: a failed email never blocks the action).
- **What it protects:** saving, replacing or removing the Twitch app, the bot, the Discord bot or an own key (and generating the bot link). With 2FA on, those actions need the header `X-Step-Up`, a signed token that `POST /api/platform/buyer/mfa/verify` returns after a valid code. It lasts 10 minutes and is tied to the tenant, the user and the current activation, so turning 2FA off and on again invalidates old tokens. Without 2FA the actions work as before; the panel recommends enabling it.
- Disabling 2FA and regenerating recovery codes require a valid code in the same request.

## 6. Endpoints

Public (the tenant comes from the Host where it applies):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/platform/config` | Public settings of the landing (Turnstile key) |
| `POST` | `/api/platform/waitlist`, `/api/platform/waitlist/confirm` | Waiting list with e-mail confirmation |
| `GET` | `/api/platform/signup/slug` | Is a subdomain available |
| `GET` | `/api/platform/signup/mode` | `open` or `approval`, so the form can warn before people type |
| `POST` | `/api/platform/signup`, `/api/platform/signup/confirm` | Buyer sign-up and confirmation |
| `POST` | `/api/platform/buyer/login-link`, `/api/platform/buyer/login-confirm` | Buyer sign-in by e-mail link |
| `POST` | `/api/platform/buyer/team/accept` | An invited administrator accepts (one-use token, only on the tenant's host) |
| `GET` | `/api/platform/tenant-info` | Name, readiness and requested scopes of a tenant subdomain |
| `GET` | `/api/platform/plans` | Price list for `decatron.top/planes`: paid plans with price per period, included modules and single modules (read from the database; cached 5 minutes) |

Owner (JWT with `scope=buyer`, owner of the tenant of the Host):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/platform/buyer/tenant` | Setup state with credential hints (owner only) |
| `PUT` `DELETE` | `/api/platform/buyer/twitch-app` | Twitch application (step-up) |
| `POST` `DELETE` | `/api/platform/buyer/bot-link`, `/bot` | Bot account (step-up) |
| `PUT` `DELETE` | `/api/platform/buyer/discord-bot` | Discord bot (step-up); `POST .../discord-bot/restart` reconnects |
| `PUT` `DELETE` | `/api/platform/buyer/byo/{provider}` | Own keys (step-up); `POST .../byo/{provider}/test` checks a key |
| `GET` `POST` | `/api/platform/buyer/mfa`, `/mfa/setup`, `/mfa/confirm`, `/mfa/verify`, `/mfa/recovery-codes`, `/mfa/disable` | Two-step verification |
| `POST` | `/api/platform/buyer/billing/quote` | Quote for a plan, period and modules (base, IGV, total in dollars and soles, dates) |
| `POST` | `/api/platform/buyer/billing/checkout` | Charge and apply the purchase (step-up); with `autoRenew` it saves the card first. `403 checkout_disabled` while billing is off, `403 auto_disabled` for automatic billing |
| `POST` | `/api/platform/webhooks/culqi/{secret}` | Culqi notices (secret in the URL; 404 without it). Reconciles the ledger by asking Culqi for each charge |
| `POST` | `/api/platform/buyer/billing/auto/disable` | Cancel automatic billing and delete the saved card |
| `GET` | `/api/platform/buyer/billing/culqi-key` | Public Culqi key of the mode that will be charged (test or live) |
| `PUT` | `/api/platform/buyer/billing/profile` | Billing data for the receipt (name, country, document, e-mail) |
| `GET` | `/api/platform/buyer/billing/payments/{id}/download/{pdf\|xml\|cdr}` | Receipt file of a paid payment of the tenant |

Team (owner only; invite and remove need the 2FA step-up when enabled):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/platform/buyer/team` | Members, live invitations, streamers and seats |
| `POST` | `/api/platform/buyer/team/invite` | Invite an administrator by e-mail |
| `DELETE` | `/api/platform/buyer/team/invitations/{id}`, `/members/{userId}` | Cancel an invitation; remove an administrator |

Owner or administrator (read-only routes):

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/platform/buyer/me`, `/state`, `/transparency` | Summary (with the real role), connection state without credential hints, plan and permissions |
| `POST` | `/api/platform/buyer/eventsub/restart` | Reopen the EventSub connection |
| `GET` | `/api/platform/buyer/billing/state` | Plan phase (`active`, `grace`, `expired`, `sandbox`...), expiry, modules, billing data without card ids |
| `GET` | `/api/platform/buyer/billing/payments` | Payment history with receipt number |

The platform owner has equivalent admin routes under `/api/admin/platform/` (waiting list, approved e-mails, tenants, plans, overrides, add-ons, export and purge). They are admin-only and documented here at architecture level.

## 7. Settings

| Key | Default | Purpose |
|-----|---------|---------|
| `Platform:TenantContext:Mode` / `:Rls` | `strict` / `context` | Tenant resolution and RLS mode |
| `Platform:SignupMode` | `approval` | `open` lets anyone sign up; anything else (or nothing) means only approved e-mails; hot-reloaded |
| `Platform:IdentityPerTenant` | off | One `users` row per tenant |
| `Platform:MasterKeyPath` | `/etc/decatron/tenant-master.key` | Master key file for `SecretVault` |
| `Platform:BaseUrl` / `Platform:PublicBaseUrl` | `https://decatron.top` / `https://decatron.net` | Links in e-mails and in the bot link |
| `Platform:DefaultRedirectUri` | `https://slug.decatron.top/api/auth/callback` | Twitch redirect URL of a tenant |
| `Platform:WaitlistMaxEmailsPerDay` | 40 | Daily e-mail cap shared by the waiting list and the buyer links |
| `Platform:EventSub:TenantShardCount` | 1 (1-10) | Conduit shards per tenant |
| `Platform:Discord:MaxGateways` | 20 | Simultaneous Discord gateways |
| `Platform:Lifecycle:IntervalSeconds` / `:PurgeAfterDays` | 60 / 30 | Lifecycle tick and retention before a purge is flagged |
| `Platform:Billing:CheckoutEnabled` | off | Allows `POST .../billing/checkout` to charge; hot-reloaded |
| `Platform:Billing:RemindersEnabled` | off | Sends the 7/3/1-day and grace reminders; hot-reloaded |
| `Platform:Billing:CulqiWebhookSecret` | (none) | Secret in the notices URL (24+ characters); with none the endpoint does not exist |
| `Platform:Billing:AutoRenewEnabled` | off | Allows saving a card at checkout and renewing by itself; hot-reloaded |
| `Platform:Billing:GraceDays` | 5 | Days of grace after a paid plan expires |
| `Platform:Billing:ReminderMaxPerDay` | 100 | Daily cap of reminder e-mails (separate from the waiting-list cap) |

## 8. Operating notes

- Schema changes live in `Decatron.Data/Migrations/` and are applied by hand before restarting the backend (`Add_Tenant_Credentials.sql`, `Add_Platform_Signups.sql`, `Add_Buyer_Mfa.sql`, among others).
- A fresh installation loads `Schema/baseline.sql` and then `Migrations/Seed_Platform_Base.sql` (tenant #1, the capability catalog and the internal plan). Commercial plans are not shipped: to open buyer sign-up you create them yourself, and at least a plan with the key `sandbox` is required.
- A tenant created by hand also needs its row in `tenant_subscriptions`; without it the tenant is not operational and is paused.
- `*.decatron.top` resolves through a wildcard DNS record and a wildcard certificate; nginx serves the same single-page app and sends `/api`, `/hubs` and uploads to the backend.
- Log events to watch: `tenant.ambiguous` (an authenticated user whose tenant could not be resolved), `eventsub.tenant.start`, `discord.gateway.mem`, `tenant.purge.due`, `buyer.denied`.
