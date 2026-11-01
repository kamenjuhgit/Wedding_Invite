# Selam & Kamenju — complete refined invitation

**6 January 2027 · Eva’s Garden, Redhill, Kenya.** React/Vite frontend, Flask APIs, persistent SQLite and a separate private JWT admin. This updates the existing Version 2; it does not replace its watercolor artwork or programme.

## Included in this release

- Existing envelope, birds, foliage, countdown with seconds, programme, venue and calendar preserved.
- Closing page: softly faded original couple painting, monogram/names/date above the couple, “We love because He first loved us.” — 1 John 4:19, and subtle pond shimmer. Water motion pauses offscreen/hidden tabs and respects reduced motion.
- Locally hosted Allura calligraphy for the first-page names; original typography elsewhere.
- Footer removed. The separate optional visit-statistics consent prompt remains.
- Phone required, email optional, international country selector (Kenya default), three attendance choices including Not sure yet. Guest counts never appear in public forms or API responses.
- One RSVP per normalized phone and per supplied email. Missing emails are NULL, so multiple guests may omit email.
- Four-digit email OTP for EVERY editing session: five-minute expiry, five attempts, resend cooldown, rate limits, single use. Verified session lasts ten minutes and ends after saving/canceling. No SMS and no guest passwords/accounts.
- Admin Create / Read / Update / Delete, private allocations/notes, Pending response status, source labels, review warnings, audit history and CSV exports.
- Show/Hide admin password, password-manager-compatible fields, optional seven-day remembered login using a revocable HttpOnly JWT cookie.
- Botanical validation/error cards and a matching missing-page screen.
- `scripts/assets.mjs` uses `fileURLToPath()` for every Sharp path, including folders with spaces, `%` or Unicode.

## Start locally (Windows/WSL)

Use Python 3.12+ and Node 22.12+ (Node 24 works). Open the extracted `wedding-invite-v2-refined` folder in VS Code. In a WSL terminal:

```bash
python3 setup.py
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
cd ../backend
../.venv/bin/python -m flask --app admin set-admin
```

Choose an admin password of at least 14 characters. The prompt is hidden. `setup.py` creates settings and a random secret only if they do not exist. On native Windows use `python` and `.venv\Scripts\python.exe` instead of the WSL paths.

Run these in **four separate terminals**, starting from the project root:

| Service | Commands | Open |
|---|---|---|
| Public API | `cd backend` then `../.venv/bin/python public.py` | localhost:5000 |
| Private admin API | `cd backend` then `../.venv/bin/python admin.py` | localhost:5001 |
| Invitation | `cd frontend` then `npm run dev` | http://localhost:5173 |
| Admin | `cd frontend` then `npm run admin` | http://localhost:5174/admin.html |

Keep `VITE_API_URL` and `VITE_ADMIN_API_URL` empty locally. Vite proxies public requests to 5000 and admin requests to 5001. Use `localhost` consistently. Admin access uses cookies; switching between localhost and 127.0.0.1 switches browser sites.

### npm 12 install-script warnings

If npm explicitly says esbuild/sharp install scripts were blocked, review `npm install-scripts ls` and approve only those trusted packages using `npm install-scripts approve esbuild` and, if listed, `npm install-scripts approve sharp`. Follow your installed npm's prompt for saving approval. Do not enable every dependency's install script globally. These commands belong to npm 12; older npm versions may not have them. Do not repeatedly reinstall npm itself.

## IMPORTANT: upgrading your existing project

1. Stop the old services and make a private backup of the complete old project and SQLite file. Keep the old database, `.env` files and custom artwork.
2. Use the new source/dependency files. **Do not overwrite your customized `public/branding/monogram.png`, portrait, or wedding wording/config without comparing them first.** This package contains the artwork from our saved project, not unseen edits on your laptop.
3. Keep your existing `DATABASE_PATH` and JWT secret. Both Flask apps must use the same database on the same persistent disk.
4. Merge the NEW email settings from `backend/.env.example` into your existing `.env`; setup does not rewrite existing files. Old SMS settings are no longer used.
5. Reinstall Python and npm dependencies using the commands above. Set local `VITE_ADMIN_API_URL=` to use the proxy.
6. Start the backend. The versioned migration makes a `.before-email-<timestamp>.bak` SQLite snapshot before changing an existing schema. It adds columns/indexes without deleting responses, visitor records or the admin password. Existing guest counts become private assigned counts.
7. Inspect migration warnings in admin. Legacy conflicting/invalid numbers or emails stay preserved; correct them after confirming with guests. New duplicates are blocked even against unresolved legacy records.
8. Deploy frontend/backend together. Old browser edit keys/SMS grants no longer authorize access. Existing guests without email need admin assistance to add one.

For a manual consistent backup (from backend):

```bash
../.venv/bin/python -m flask --app admin backup /private/path/wedding-backup.sqlite3
```

Never replace a live database with an empty local database. No database, secrets or live guest records are included in this archive.

## Email setup: required for guest editing

Default sender: **Selam & Kamenju <invitations@selamandkamenju.com>**.

The address in code is not an activated email account. Purchase/control the domain, verify it with a transactional email provider, add its required DNS records, and enter SMTP credentials in backend `.env`. Read [docs/EMAIL.md](docs/EMAIL.md). Without configuration, initial RSVPs still save; editing clearly reports that email verification is unavailable. There is no production bypass or fake success.

Phone-only confirmation directs guests to you. Phone ownership is not checked. Valid number structure does not establish an active SIM, and email domain checks do not prove mailbox ownership. Email access is proven only on an edit request.

## Admin counts and CRUD

New public RSVPs have `guest_count = NULL` (“Not assigned”). Only admin may set the allocation. Guest updates do not alter it. Confirmed people sum assigned counts on attending records; tentative people are separate. Declined records contribute zero to totals while preserving their allocation. Audit history records action, record ID and timestamp, not copies of deleted personal details.

Admin additions default to Awaiting response and send no message. A pre-added record already reserves its phone/email: the guest uses Edit My RSVP to respond, or contacts you if no email is recorded. Delete asks for confirmation and invalidates pending codes/sessions, removes the response and releases its contact identifiers. Revoke edit access ends guest editing access without deleting the record. Later access still requires a fresh email OTP.

Ordinary admin login lasts 30 minutes; Remember me lasts seven days. Password changes through `set-admin` revoke all admin sessions. Logout revokes the current session server-side. Browser password saving remains under the browser/user's control. Admin is loopback-only; it is not merely a hidden page.

## Branding and content

- Replace only `frontend/public/branding/monogram.png` with your transparent PNG (ideally 1024 square). Build regenerates favicon, home-screen icons and social stationery.
- `frontend/src/config.js`: wedding wording, date, venue, programme, portrait path. The old maxGuests setting is no longer used by the public form.
- `frontend/src/branding.json`: central monogram/image paths.
- `frontend/src/closing-refinement.css`: closing portrait opacity, title calligraphy and pond shimmer. Font license is included in `public/fonts`.
- `frontend/src/ClosingIllustration.jsx`: biblical closing wording and composition. The image remains `couple-pastel.webp`; custom portrait paths omit the position-specific pond shimmer.
- `frontend/src/rsvp-updates.css`: form, error and admin additions.
- `frontend/src/motion.js`: original coordinated animation presets.
- `frontend/scripts/assets.mjs`: generated image composition. Manual edits to generated social previews/icons are overwritten on build; edit the generator if you want a permanent custom composition.

The countdown targets midnight in Nairobi to count down the date; the ICS event remains all-day with no invented ceremony times. The exact Eva’s Garden directions link and optional map fallback remain. See [docs/MAPS.md](docs/MAPS.md).

## Build and tests

```bash
# frontend
npm run build
npm run build:admin
npm test
# backend, using the venv
../.venv/bin/python -m pytest -q
```

Read [docs/QA.md](docs/QA.md) for actual verification and limitations. Real email delivery and browser/device visual checks are still required on your final environment.

## Deployment

Only `frontend/dist` goes to Netlify. Flask runs separately on an HTTPS server with persistent SQLite storage. Admin runs privately through an SSH tunnel. Never publish `dist-admin`, `.env`, SQLite, CSV exports or backups. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
