# Verification — email-editing release, 1 November 2026

## Completed on this release

- Public production build and separate admin production build pass.
- 41 backend integration tests pass against disposable SQLite databases.
- 8 frontend/asset tests pass.
- Actual HTTP startup smoke test returns 200 from `/api/health` and checks database connectivity.
- Backend coverage: phone-only/missing-email records; normalized phone/email uniqueness; Kenyan/international validation; all three public responses; private count/note exclusion; idempotent network retries; authenticated read/update; five-minute OTP expiry; five-attempt lockout; resend cooldown and invalidation; single use; ten-minute session expiry; mail-disabled/failure cases; admin CRUD/authentication; remembered cookie and logout; loopback restriction; origin rejection; revocation during email sending; concurrent duplicate writes; audit history; CSV formula safety; consented visits; additive migration and backups preserving conflicting legacy rows.
- SMTP contract test verifies TLS, sender, recipient, code text and expiry wording using an intercepted transport. NO real email was sent.
- Frontend rendering checks confirm optional email, Not sure yet, Kenya default, no public count input, attendance-specific confirmation and phone-only contact instructions.
- API client checks verify structured errors and explicit credentialed admin requests.
- Asset generator runs successfully in a temporary folder containing spaces, `%` and Unicode; custom monogram bytes remain unchanged.
- Existing ICS all-day format, icon/social sizes and initial-HTML metadata tests pass.
- Source review confirms closing scripture/top monogram/faded portrait, Allura first-page names, no footer, reduced-motion pond treatment, and preserved existing artwork.

## Not certified here

- Browser visual/interaction QA for this release: browser preview access was blocked in this session. This release's new forms/closing composition have not been certified at each viewport or on physical devices. Earlier version visual checks are not presented as current results.
- Real email inbox delivery, sender-domain verification, spam placement or provider activation. SMTP acceptance alone does not prove inbox receipt.
- Full deployed browser → Flask → real email → edit flow.
- Production SSH tunnel and private admin cookie behaviour on your chosen host configuration.
- Optional Google Maps credentials/style and WhatsApp preview after the real domain is live.
- LCP, INP, CLS and animation frame rate on actual mobile hardware.
- Your real database migration: automated tests use synthetic legacy records. No live guest database was accessed.

## Launch checklist

1. Back up your existing project/database/custom images. Merge settings and preserve DATABASE_PATH/JWT_SECRET.
2. Review migration warnings in admin. Confirm existing counts and guest records remain.
3. Set correct frontend/API HTTPS URLs and exact PUBLIC_ORIGIN. Keep admin private.
4. Purchase/verify the email sender domain and configure SMTP. Test real inbox delivery and five-minute expiry.
5. Test phone-only and email-enabled RSVPs, duplicate phone/email, Not sure yet, edit, email removal, admin add/edit/delete, and remembered login/logout.
6. Confirm public responses contain no admin counts or private notes.
7. Inspect 320, 360, 375, 390, 414, 430, 768, 1024, 1440 and 1920px widths. Test keyboard focus, reduced motion, native scrolling and no overflow. Confirm text is above faces on the closing illustration.
8. Check calendar, directions, favicon and social preview. Review the preserved programme wording/times before sharing.
