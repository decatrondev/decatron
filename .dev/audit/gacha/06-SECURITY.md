# 06 - Security Audit: GachaVerse

**Audit Date:** 2026-04-04
**Auditor:** AnthonyDeca
**Scope:** Full security review of the GachaVerse standalone application
**Severity Levels:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Summary

The GachaVerse application has **2 CRITICAL**, **8 HIGH**, and **6 MEDIUM** severity security issues. Many stem from the application being developed as a single-user hobby project without security hardening. The migration to Decatron will resolve all identified issues by leveraging Decatron's existing security infrastructure.

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 8     |
| MEDIUM   | 6     |
| **Total**| **16**|

---

## CRITICAL Findings

### C-1: Hardcoded Secrets in .env

**Location:** `.env` (root)
**Description:** Database passwords, API credentials, and bot tokens are hardcoded with weak, predictable values directly in the environment configuration file.

**Exposed secrets include:**
- MySQL/MariaDB root password: `Decadbroot=1`
- PostgreSQL password: `Deca3062=1!`
- Twitch Client ID (full value in plaintext)
- Bot credentials (username and OAuth token)

**Impact:** If the `.env` file is exposed via misconfiguration, source control leak, or directory traversal, an attacker gains full database access and can impersonate the bot on Twitch.

**Risk:** Complete system compromise, data exfiltration, bot hijacking.

---

### C-2: Hardcoded Bot Tokens in Database Schema

**Location:** `schema_postgresql.sql`, lines 237-265
**Description:** The PostgreSQL schema file contains hardcoded bot authentication tokens inserted as seed data:
- `access_token` (Twitch API access)
- `refresh_token` (Twitch token refresh)
- `chat_token` (IRC/chat authentication)

All tokens are stored in plain text within the SQL file.

**Impact:** Anyone with access to the repository or schema file can extract valid bot tokens. These tokens grant full API access to the bot's Twitch account and the ability to send messages in any channel the bot has joined.

**Risk:** Bot account takeover, unauthorized message sending, channel manipulation.

---

## HIGH Findings

### H-1: Unrestricted Collection API

**Location:** API routes
**Affected Endpoints:**
- `GET /api/cards/:userId`
- `GET /api/stats/:userId`
- `GET /api/history/:userId`

**Description:** These endpoints are publicly accessible without any authentication. Any unauthenticated user can enumerate user IDs and retrieve complete collection data, pull statistics, and history for any participant.

**Impact:** Full data scraping of all user collections and activity. Privacy violation for all participants.

---

### H-2: SQL Injection in Profile Controller

**Location:** `profileController.js`, lines 106-111
**Description:** Dynamic field names are constructed by iterating over object keys from user input and concatenating them directly into SQL query strings without parameterization or whitelist validation.

```
// Vulnerable pattern (conceptual):
Object.keys(body).forEach(key => {
  query += `${key} = $${i}`;  // key comes from user input
});
```

**Impact:** An attacker can inject arbitrary SQL by crafting object keys containing SQL syntax. This can lead to data exfiltration, modification, or deletion.

---

### H-3: Weak Session Configuration

**Location:** Session middleware setup
**Description:** Session cookies are configured without essential security flags:
- No `httpOnly` flag (cookies accessible via JavaScript)
- No `secure` flag (cookies sent over HTTP)
- No `sameSite` attribute (vulnerable to cross-site request inclusion)
- Weak default session secret

**Impact:** Session hijacking via XSS, session theft over unencrypted connections, cross-site attacks.

---

### H-4: No CSRF Protection

**Location:** All POST endpoints (application-wide)
**Description:** The application does not implement any Cross-Site Request Forgery protection. No CSRF tokens are generated or validated on form submissions or state-changing API calls.

**Impact:** An attacker can craft malicious pages that perform actions on behalf of authenticated users, including modifying gacha items, changing settings, or manipulating collections.

---

### H-5: No Rate Limiting

**Location:** Application-wide
**Description:** No rate limiting middleware is configured on any endpoint.

**Vulnerable surfaces:**
- `/login` endpoint: susceptible to brute force attacks
- Collection API (`/api/cards/`, `/api/stats/`, `/api/history/`): susceptible to data scraping
- Pull endpoints: potential for automated abuse
- All POST endpoints: no protection against request flooding

**Impact:** Brute force credential attacks, denial of service, automated data harvesting.

---

### H-6: Access Control Bypass in Collection Controller

**Location:** `collectionController.js`
**Description:** The controller does not validate that the requested participant belongs to the currently authenticated user. Any authenticated user can access or modify any other user's collection data by manipulating the participant ID parameter.

**Impact:** Unauthorized access to other users' inventories, potential for item manipulation across accounts.

---

### H-7: Session Fixation via Debug Endpoints

**Location:** Debug/development routes
**Affected Endpoints:**
- `/collection/debug-session`
- `/collection/force-login`

**Description:** These endpoints allow direct manipulation of session state. An attacker can use them to fix a session ID, inject arbitrary session data, or force authentication as another user.

**Impact:** Account takeover, session hijacking, privilege escalation.

---

### H-8: Inadequate Input Validation in Commands

**Location:** Chat command handlers
**Description:** Input validation for bot commands is minimal. The only sanitization applied is removal of invisible Unicode characters. There is no strict whitelist, no length validation, and no structured input parsing.

**Impact:** Command injection, unexpected behavior, potential for abuse through specially crafted input strings.

---

## MEDIUM Findings

### M-1: Error Information Disclosure

**Location:** Multiple controllers
**Description:** Raw `error.message` content from exceptions is returned directly to users in API responses. This can expose internal implementation details, database structure, file paths, and library versions.

**Impact:** Information leakage that aids further exploitation.

---

### M-2: Insecure File Upload

**Location:** File upload handler
**Description:** Multiple issues in file upload implementation:
- MIME type validation can be bypassed (only checks Content-Type header)
- Uploaded files are stored in the public web root (directly accessible)
- Filenames are predictable (no randomization)

**Impact:** Malicious file upload, potential for stored XSS via SVG/HTML uploads, web shell deployment if execution is possible.

---

### M-3: Missing Security Headers

**Location:** Application-wide (HTTP responses)
**Description:** The application does not use `helmet.js` or any equivalent security header middleware. Missing headers include:
- `X-Frame-Options` (clickjacking protection)
- `Content-Security-Policy` (XSS/injection mitigation)
- `X-Content-Type-Options` (MIME sniffing prevention)
- `Strict-Transport-Security` (HTTPS enforcement)
- `X-XSS-Protection` (legacy XSS filter)
- `Referrer-Policy` (referrer leakage prevention)

**Impact:** Increased attack surface for clickjacking, XSS, MIME confusion, and data leakage.

---

### M-4: XSS in EJS Templates

**Location:** EJS view templates
**Description:** Error messages sourced from query parameters are rendered directly into HTML templates without proper escaping. Using `<%- %>` (unescaped output) instead of `<%= %>` (escaped output) allows injection of arbitrary HTML and JavaScript.

**Impact:** Reflected XSS attacks. An attacker can craft URLs that execute JavaScript in the context of a victim's session.

---

### M-5: No Password Policy

**Location:** Authentication/registration
**Description:** No password policy is enforced:
- No minimum length requirement
- No complexity requirements (uppercase, numbers, symbols)
- No check against common/breached passwords
- No account lockout after failed attempts

**Impact:** Weak passwords are accepted, increasing vulnerability to brute force and credential stuffing attacks.

---

### M-6: Unvalidated Redirect in Profile

**Location:** Profile controller
**Description:** The username parameter is passed directly into a bot URL construction without URL encoding or validation. This can be abused for open redirect attacks or to inject unexpected characters into URLs.

**Impact:** Phishing via open redirect, potential for URL-based injection.

---

## Migration Resolution

**ALL identified security issues will be resolved by migrating to Decatron.** The Decatron platform already implements:

| Security Control | Decatron Implementation |
|-----------------|------------------------|
| Secret Management | Environment-based config with proper secret handling, no hardcoded tokens |
| Authentication | Twitch OAuth2 with secure session management |
| Authorization | `RequirePermission` attribute-based access control |
| CSRF Protection | ASP.NET Core built-in anti-forgery tokens |
| Rate Limiting | Middleware-based rate limiting on all endpoints |
| Input Validation | Model validation with data annotations + FluentValidation |
| Security Headers | Helmet-equivalent middleware configured |
| Session Security | Secure, HttpOnly, SameSite cookies with strong secrets |
| SQL Injection | Entity Framework Core with parameterized queries (no raw SQL concatenation) |
| XSS Protection | Razor/React with automatic output encoding |
| File Upload | Validated uploads with randomized names outside web root |
| Error Handling | Global exception handler that returns generic messages to clients |

No legacy security debt will carry over into the migrated system.
