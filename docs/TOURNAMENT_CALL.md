# Streamer call

Español: [es/TOURNAMENT_CALL.md](es/TOURNAMENT_CALL.md)

The call is an informational page separate from the operational tournament. Its route is `/convocatorias/fortnite-streamers`; the public guide is `/docs/convocatorias`. Matches and standings are still created from `/features/torneos`.

## Prepare content

The platform owner opens `/admin/convocatorias`, also linked from the administration hub. **Guide** is the first tab. **Content** offers an initial proposal and editable title, introduction, image description and requirements in Spanish and English, plus a real cover image selector.

A map screenshot from the [official Epic Games listing](https://store.epicgames.com/p/fortnite) is included for illustration. It does not confirm the map for the future tournament. PNG, JPG and WebP images from `/admin/brand` can also be selected. Check usage permission before publication and enter author and HTTPS source. Image descriptions are required in both languages.

Colors, typography and shapes come from `/admin/estilo`; the public logo respects `/admin/brand`. The public page stays dark while the editor follows the application theme.

## Draft and publication

**Save draft** preserves changes without changing the public version. **Preview draft** displays current content. Save before publishing. **Publish informational page** copies the saved draft to the public version; **Unpublish** hides the page and keeps the draft. If another session changed the content, reload before saving to prevent overwriting it.

Without a published version, visitors see an unpublished notice. Loading errors offer a retry. The public API never returns the draft. Administrative operations require authentication and system owner authorization on the server.

## Current scope

Initial information describes Solo, Zero Build, Brazil servers, bot usage and streaming during the tournament. The organizer’s declared base is US$30 and giftable items up to 2,800 V-Bucks; distribution remains pending. Cash and items are shown separately.

**I want to play** and **I want to collaborate** link to their sections. Once the owner opens applications, signed-in visitors can submit the corresponding form. Contributions are opened separately. The **Collaborate** button opens a panel inside the call itself: money is paid there, without waiting for approval, and V-Bucks, gift cards and gifts are offered through an application. The free donation flow at `/supporters?call=fortnite-streamers#donar` remains available as a fallback and preserves the call destination; general `/supporters` donations remain independent. A charge does not automatically confirm prize availability.

## Applications and review

Publishing content does not open applications. In **Guide**, the owner can open them after publication and close them when needed. Unpublishing also closes applications. They start closed.

Applications use the authenticated identity and its own linked Twitch or Kick channels, not the channel selected for moderation. People with several own channels choose one. Available contact information is prefilled and can be corrected. Epic accounts and final tournament registration belong to the later tournament step.

Interested streamers declare bot usage and commit to streaming during the tournament. This declaration does not automatically verify activity. Collaborators offer V-Bucks or a gift card, with an amount, currency where applicable and promotion details, and accept the custody notice (see below). Money is no longer offered through this form: it is contributed by paying. Money applications that already existed are kept and can still be edited. An offer does not charge money or increase the prize pool.

Applications start pending. The owner uses **Interested streamers** or **Collaborators**, filters by status and approves, rejects or returns applications to pending, with a comment visible to the applicant. Approval does not confirm a final place, verified bot usage or receipt of a contribution.

Applicants can view status, update or withdraw their application. Updating returns it to pending and hides the public profile until approved again. Withdrawal hides the profile and the owner cannot approve a withdrawn application; the person may resubmit while applications are open. After closing, applicants can still view or withdraw from the published page.

Only name, image and channel appear publicly, after approval and explicit consent. Contact, notes, currency and proposed amounts are excluded from the public API. A collaborator profile indicates a reviewed application, not a received contribution. A snapshot of accepted requirements is kept; submissions are rejected if the published content changed since the page was loaded.

## Direct money contributions

Money needs no approval. The person presses **Collaborate**, chooses the **Money** tab, enters the reference USD amount and pays with Culqi without leaving the page, using a single **Pay** button. Without a session the contribution is anonymous and creates no profile. Signed in, they choose their own channel and may tick “I want to appear as a collaborator”: the suggested name is their channel’s and can be edited.

When the charge completes, the server links the payment to that person’s collaborator profile. If they had none, it creates a pending one with origin “created by a payment”. If they already had one submitted through the form, it links it without modifying or approving it. Linking is auxiliary: if it fails, the payment is still recorded, the organizer still sees who paid and, when receipt is confirmed, the link is repaired automatically. A charge is never repeated.

In **Contributions** the organizer sees the account name and channel of whoever paid while signed in, and in **Collaborators** the contributions linked to each profile. When the organizer **confirms receipt** of a linked contribution, the profile created by that payment becomes approved, and is public only if the person allowed it when paying. If the contribution is reversed and no other confirmed one remains, the profile returns to pending. Withdrawing public identity from the receipt hides that profile. A test payment is never confirmed and never approves a profile. Profiles submitted through the form are never approved automatically.

Signed-in visitors see **My contributions and my application** on the call: the status of their profile and of each contribution (with a test label), and the received and prize amounts only after confirmation. It does not depend on the receipt stored in one tab. There is no automatic notification: status is visible when they return to the page.

### Tournament link and bot status

In the **Guide** tab, the **Tournament registration link** field accepts only an internal path `/torneos/<channel>/<edition>` (for example `/torneos/pixipnj/decatron-streamers-cup`); anything else is rejected. With the link set and applications open, the call shows a **Register for the tournament** button that leads to the official registration; the interest form stays available. In **Interested streamers**, each application shows whether the bot is **on** or **off** in the applicant's channel, or "no data". It is only the bot switch: it does not prove they use it, and checking usage remains manual. Only the organizer sees this status.

## Custody of V-Bucks, gift cards and gifts

Contributions of V-Bucks, gift cards or gifts remain in the custody of the contributor who offers them: they manage them and deliver them to the winner under what they agree. The organizer and Decatron display what the contributor declares, but do not hold or deliver these prizes. Money charged through the payment flow is received and administered by the organizer.

When offering them, the custody notice is shown and must be accepted with a checkbox. The date and the exact version of the accepted text are stored; if the text version changes, a form opened with the previous text is rejected until reloaded. Showing the amount publicly is a separate consent (available only if the public profile is allowed) and is not reused from the profile consent.

V-Bucks cannot be gifted directly in Fortnite: only Item Shop items of the day or gift cards can be gifted, with two-factor authentication, level 2 or higher, a friendship of at least 2 days and a maximum of 5 gifts per 24 hours. The form reminds this when V-Bucks are offered.

Approved offers with a public profile and an authorized amount appear in a separate list, **Prizes in contributors’ custody**, with “managed and delivered by [name]”. They are declared data: they are not added to available prizes or mixed with money. The notice text lives under `custody.notice` in the call’s translations and its version in `TournamentCallApplicationRules.CustodyNoticeVersion`.

## Application API

| Route | Access and behavior |
|---|---|
| `GET /api/me/convocatorias/fortnite-streamers` | Own session: linked channels, contact and own applications. |
| `PUT /api/me/convocatorias/fortnite-streamers` | Creates or updates an own application with acceptance and current revision. |
| `POST /api/me/convocatorias/fortnite-streamers/{kind}/withdraw` | Withdraws an own application of that kind. |
| `GET /api/admin/convocatorias/fortnite-streamers/applications` | Owner only: paginated inbox by kind and status. |
| `PUT /api/admin/convocatorias/fortnite-streamers/applications/{id}` | Owner only: changes review and comment. |
| `PUT /api/admin/convocatorias/fortnite-streamers/applications-open` | Owner only: opens or closes applications on the published page. |

Revision checks prevent overwriting another session’s changes. Two channels linked to the same account cannot create duplicate applications of the same kind. Participation and collaboration are separate applications; a person may submit both.

Applications do not block existing account or channel removal: deleting them removes their related applications. Removing a reviewer account keeps the application and clears that reference.

## Installation and verification

Apply `Decatron.Data/Migrations/Add_Tournament_Call_Page.sql`, then `Decatron.Data/Migrations/Add_Tournament_Call_Applications.sql`, `Decatron.Data/Migrations/Add_Tournament_Call_Contributions.sql` and `Decatron.Data/Migrations/Add_Tournament_Call_Direct_Contribution.sql` before starting a backend version using this feature. All are idempotent. The first seeds the draft row; the second adds application opening and its private table; the third adds contributions, history, payment attempts and contribution opening, initially closed; the fourth adds the profile origin, custody acceptance with its version, public-offer consent and the user and channel of the payment attempt. `Decatron.Data/Schema/baseline.sql` includes the generated definitions; apply the migration to seed the initial row. If phases 1 to 3 are already installed, only the fourth migration remains and it must be applied before restarting the backend.

Applying SQL does not publish content. Building does not restart services or deploy the page.

Feature checks: `node ClientApp/tools/validate-tournament-call.mjs`, `dotnet test Decatron.Tests/Decatron.Tests.csproj --filter FullyQualifiedName~TournamentCall`, frontend type checks and build. Database tests require `DECATRON_APP_CONN` pointing exclusively to `decatron_schema` and roll back transactions. New contribution tests fail explicitly without that connection; earlier application tests report a skip. Skips do not count as passing. Visual checks using simulated responses do not replace authenticated verification of deployed endpoints.


## Contributions and prizes

In `/admin/convocatorias`, **Contributions** records money, gift cards and available items. Use a unique, stable private reference; link an existing donation by its ID rather than counting it again as manual. A collaborator application can be linked, but its approval does not prove receipt. The declared base of US$30 and item gifts worth up to 2,800 V-Bucks is not automatically confirmed either.

Enter the public ES/EN description, currency (leave empty for item units), net amount received, allocation to prizes, administrator, person responsible for delivery and private evidence of receipt and availability. For money linked to a payment, net funds cannot exceed the charge and the currency must match. Test payments and tiers cannot be confirmed as prizes. The gross charge, net funds and allocation are shown separately; no estimated fee or currency conversion is used to total prizes.

**Awaiting review** does not count toward prizes. **Received and confirmed** publishes only the allocation, description and responsible people. **Reversed** removes the contribution from prizes, preserves history and does not issue a refund. Reversed contributions cannot be reactivated. Corrections and consent withdrawals remain in private history; reload before saving if another session changed the entry.

Public anonymity is the initial state. Publishing a name, channel and contribution requires specific authorization with private evidence; prior collaborator profile consent does not cover this purpose. Do not include personal information in an anonymous contribution’s description. The public API excludes references, payments, contact, evidence and internal identifiers. Money is grouped by currency; gift cards and items are shown separately. The page does not promise transfers of V-Bucks or an unconfirmed distribution.

## Donations intended for prizes

From the call, the **Collaborate** button opens payment inside the same page when the owner enables contributions from **Guide**; the free block at `/supporters?call=fortnite-streamers#donar` remains available as a fallback and uses the same panel. This is independent of applications; withdrawing the page closes both entry points. The initial state is closed.

The donor chooses a reference USD amount and, only when signed in, may authorize publication of their name, channel and contribution. The exact PEN charge, calculated on the server, is shown before payment. The indicative US$12 allowance for an intended US$10 allocation is explained without stating a fee or guaranteeing net funds. A donation does not purchase a tier, place or reward.

The reference and destination are stored before contacting the provider. The charge uses the prepared amount rather than an amount submitted at payment time. The private receipt is kept in the same browser tab and lets its holder check status, view the confirmed net amount and prize allocation, and withdraw their public identity. The payer’s name is not public by default. Hiding identity does not remove a confirmed contribution from prizes.

A confirmed charge still awaits the owner’s verification of received and available funds. If the outcome is uncertain, do not pay again: the owner checks the reference in Culqi and uses **Check and reconcile charge** with the verified ID. This action only fetches an existing charge and verifies its reference, amount, currency, capture and absence of refunds. It never creates a charge. Replaying the same attempt or confirmation does not increase prizes. A 3DS retry preserves token, device, reference and amount. If payment mode or public key changes, an uncharged attempt must be canceled and prepared again.

An attempt can be canceled before its first charge or while waiting for bank authentication. Processing or uncertain outcomes require reconciliation. Subsequent refunds are reflected through administrative review and reversal; this phase adds no refund synchronization or automatic refunds. The organizer must verify availability before confirming and review later incidents.

### Existing approved money collaborations

Money applications sent before this flow still exist. If one is approved, its holder sees in their application the link to make or check a contribution; payment works like any other, from **Collaborate**, and the amount offered in the application is not charged automatically. For approved gift cards, V-Bucks and gifts, the person sees the coordination instructions in the organizer’s comment, which must give a private delivery method during review. No automatic notification is sent. Publishing the profile and authorizing the contribution’s identity remain separate, and approval does not prove receipt or availability for prizes.

## Contribution API

| Route | Access and effect |
|---|---|
| `GET/POST /api/admin/convocatorias/fortnite-streamers/contributions` | Owner: list or record contributions. |
| `PUT /api/admin/convocatorias/fortnite-streamers/contributions/{id}` | Owner: review, confirm or reverse with concurrency checking. |
| `GET /api/admin/convocatorias/fortnite-streamers/contributions/{id}/history` | Owner: private audit history. |
| `GET /api/admin/convocatorias/fortnite-streamers/contributions/recovery` | Owner: up to 100 attempts awaiting reconciliation. |
| `PUT /api/admin/convocatorias/fortnite-streamers/donations-open` | Owner: open/close contributions; does not open applications. |
| `POST /api/supporters/call-donations/prepare` | Prepare amount, private reference and destination. Signed in, it validates and stores the chosen channel (`channelUserId`). |
| `GET /api/supporters/call-donations/mine` | Own session: your contributions; received and prize amounts only after confirmation. |
| `POST /api/supporters/call-donations/charge` | Charge the prepared attempt; 3DS if requested by the provider. |
| `POST /api/supporters/call-donations/receipt` | Retrieve status with the private receipt key in the request body. |
| `POST /api/supporters/call-donations/withdraw-identity` | Receipt holder: hide public identity. |
| `POST /api/supporters/call-donations/cancel` | Cancel an attempt that has not reached an attributable charge. |
| `POST /api/supporters/call-donations/reconcile/{id}` | Owner: verify and record an existing Culqi charge. |

Direct-flow changes to the other routes: `GET /api/convocatorias/fortnite-streamers` adds `custodyOffers` (approved offers only, with a public profile and an authorized amount) and `custodyNoticeVersion`; `PUT /api/me/convocatorias/fortnite-streamers` accepts `acceptedCustody`, `publicOffer` and `custodyNoticeVersion` and rejects new money with `money_via_payment`; the owner’s applications inbox includes `origin`, what was accepted for custody and linked contributions; the owner’s contribution list includes who paid while signed in. New codes: `custody_required`, `notice_changed`, `public_offer_requires_listing`, `money_via_payment`, `channel_not_owned`.

The receipt key is private: it is kept out of URLs and public listings and stored as a server-side hash. The new tables are `tournament_call_contributions`, `tournament_call_contribution_events` and `tournament_call_donation_intents`; the additive migration is `Add_Tournament_Call_Contributions.sql`. They do not link a tournament edition or change its operational prizes.

Provider references consulted for capture and review: [Culqi API](https://apidocs.culqi.com/), [3DS flow](https://docs.culqi.com/es/documentacion/culqi-3ds/flujo-con-3ds/) and [account statement and net funds](https://docs.culqi.com/es/documentacion/pagos-online/depositos/estado-cuenta/). Account-specific fees are not inferred from these guides.

Contributions linked to prizes and test payments are excluded from general monthly support progress in `/supporters`. General donations and tier purchases keep their existing flow. An explicit bank decline ends the attempt without confirming a contribution and permits a voluntary new attempt; ambiguous responses still require reconciliation.
