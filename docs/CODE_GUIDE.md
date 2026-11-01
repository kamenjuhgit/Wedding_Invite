# Reading the code

Code stays executable; comments explain intent and security decisions.

| File | Responsibility |
|---|---|
| main.jsx | Existing section order, envelope state, countdown, consent; no footer |
| config.js / branding.json / motion.js | Central wedding information, branding, animation timings |
| PortraitOpening.jsx / WaxSeal.jsx | Existing physical envelope/seal sequence |
| BotanicalScene.jsx / Transition.jsx | Birds/foliage and coordinated reveal effects |
| ClosingIllustration.jsx / closing-refinement.css | Faded original painting, top monogram/scripture and pond shimmer; first-page calligraphy |
| RSVP.jsx | New / returning / verification / edit / saved states; only non-secret completion flags stored locally |
| ContactFields.jsx | International country selector and frontend contact validation |
| OTPAccess.jsx | Registered phone/email, request/resend, five-minute countdown and verification |
| RSVPConfirmation.jsx / CalendarAction.jsx | Attendance-aware confirmation and all-day calendar |
| ErrorCard.jsx / rsvp-updates.css | Botanical error, missing-page and updated form styling |
| admin.jsx | Cookie-authenticated guest CRUD, allocation counts, audit, filters, exports and login controls |
| api.js | JSON, timeouts, errors, optional memory-only guest bearer and explicit admin credentials |
| scripts/assets.mjs | fileURLToPath-safe build-time branding and responsive artwork |
| backend/app.py | App configuration, auth, network/origin protections, persistent rate limits, visits and CLI |
| backend/database.py | Backup and additive versioned SQLite migration |
| backend/validation.py | Shared international phone/email normalization and validation |
| backend/mailer.py | Encrypted provider-neutral SMTP delivery; no secrets in frontend |
| backend/rsvp_routes.py | Transactions, duplicate checks, OTP/session lifecycle and admin CRUD |
| backend/public.py / admin.py | Separate public and private services |

Guest sessions: OTP verification → random bearer token in React memory → authenticated read/update → save or cancel revokes token. No old browser credential or phone-only bypass exists. Public responses explicitly select public fields and never include counts/private notes.

Admin sessions: password check → JWT inside HttpOnly SameSite Strict cookie → JWT signature/expiry plus database revocation check on every protected route. Remember me changes the expiry to seven days; normal login is 30 minutes.

All duplicate checks and writes run inside serialized SQLite transactions. Unique indexes provide a second guard. Legacy conflicting rows remain visible for review. Revisions reject stale edits. Submission IDs acknowledge identical network retries without returning stored personal data.
