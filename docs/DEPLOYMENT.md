# Hosting the invitation without exposing the admin

## Recommended arrangement

**Netlify:** public React frontend only.

**A small Linux server with persistent disk and SSH:** Flask public service, private admin service and SQLite. Both Flask processes use the same local database file. Your laptop uses an SSH tunnel to the private service. This extra separation is needed for your computer-only admin requirement; a hidden `/admin` URL would not enforce it.

Netlify's native functions use JavaScript/TypeScript/Go, so do not try to deploy this long-running Flask application as a Netlify function. An ephemeral filesystem is also unsuitable for SQLite. Render supports persistent disks on qualifying paid services, but a general Linux VPS is a clearer fit for the two local processes plus SSH tunnel in this project. Hosting prices and provider configuration are not assumed here.

Official references checked when preparing this package:
- https://www.netlify.com/platform/core/functions/
- https://docs.netlify.com/build/frameworks/overview/
- https://render.com/docs/disks
- https://render.com/docs/free

## Public frontend on Netlify

1. Put the project in a private Git repository, excluding `.env`, databases and backups. `package-lock.json` should be committed.
2. Import that repository into Netlify. The root `netlify.toml` declares base `frontend`, build `npm ci && npm run build` and publish folder `dist` relative to that base.
3. Set `VITE_API_URL=https://api.YOUR-DOMAIN.example` to your actual HTTPS Flask API address. This is a public address, not a password. Never put JWT_SECRET or an admin password into any `VITE_` variable: Vite includes those values in browser JavaScript.
4. Set `VITE_SITE_URL` to your canonical HTTPS invitation origin (no trailing slash). This creates absolute social image and canonical URLs in the initial HTML. Netlify builds reject missing HTTPS site/API settings.
5. Deploy. Set backend `PUBLIC_ORIGIN` to the exact resulting frontend origin, e.g. `https://YOUR-SITE.netlify.app`, without a trailing slash or path. Redeploying React is required after a Vite environment-variable change.
6. Publish **only** the public bundle. There is no need to build or upload `dist-admin` to Netlify.

## Backend on your Linux server

Use a non-root service account and a directory such as `/srv/wedding` owned by that account. Copy the project there, install Python/venv and create `.venv`. Run `python3 setup.py`, install `backend/requirements.txt`, and set the admin password as described in README.

Edit `/srv/wedding/backend/.env`:

```dotenv
# Use the generated random value from setup.py, not a sample secret.
JWT_SECRET=YOUR_OWN_RANDOM_SECRET
DATABASE_PATH=/srv/wedding/backend/data/wedding.sqlite3
PUBLIC_ORIGIN=https://YOUR-SITE.netlify.app
ADMIN_ORIGIN=http://localhost:5174
MAIL_FROM=invitations@selamandkamenju.com
# Add SMTP settings from docs/EMAIL.md
TRUST_LOCAL_PROXY=1
```

The directory containing SQLite must be writable by both processes and must persist across deployments. Keep the `.env` readable only by the service account. Never run setup over your production data folder in a way that replaces it. Keep a private backup before deployments.

Run the two production processes from `/srv/wedding/backend` under a process manager such as systemd:

```bash
# Public service: put HTTPS reverse proxy in front of this loopback listener.
../.venv/bin/gunicorn --workers 1 --bind 127.0.0.1:5000 public:app

# Private service: NEVER add this to a public reverse proxy.
../.venv/bin/gunicorn --workers 1 --bind 127.0.0.1:5001 admin:app
```

These are two separate long-running commands/services, not commands to paste one after another in one blocking terminal. Use one worker per service for this small SQLite app. The database rate limiter is shared and persistent.

Example systemd service, saved by the server administrator as `/etc/systemd/system/wedding-public.service`. Replace `wedding` with the actual Linux account that owns the project:

```ini
[Unit]
Description=Wedding public API
After=network.target

[Service]
User=wedding
WorkingDirectory=/srv/wedding/backend
ExecStart=/srv/wedding/.venv/bin/gunicorn --workers 1 --bind 127.0.0.1:5000 public:app
Restart=on-failure
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Create a second unit `wedding-admin.service` with description `Wedding private API` and ExecStart ending in `--bind 127.0.0.1:5001 admin:app`. Then the server administrator enables and starts them with systemctl. Neither service needs a publicly open Python port.

Configure an HTTPS reverse proxy for the **public API only**. Example Caddy site block, replacing the domain with one whose DNS already points to the server:

```caddyfile
api.YOUR-DOMAIN.example {
    reverse_proxy 127.0.0.1:5000 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

`TRUST_LOCAL_PROXY=1` enables exactly one trusted forwarded IP hop, for the public app only. It is appropriate only when the public Flask listener is on loopback behind this proxy, which overwrites X-Forwarded-For. Never enable it with an externally exposed Flask listener or a different unreviewed proxy chain. Without it, requests behind one proxy share a rate-limit bucket.

Allow only HTTPS, HTTP (for certificate redirects/issuance if needed) and your controlled SSH access through your server firewall. Do not allow inbound 5000 or 5001. Use SSH keys and protect your private key. Do not run Flask's development server in production.

## Your private admin, after deployment

On your computer, open a terminal and keep this running:

```bash
ssh -N -L 127.0.0.1:5001:127.0.0.1:5001 YOUR_USER@YOUR_SERVER
```

This makes your own computer's port 5001 reach the server's loopback-only private API over SSH. Stop your local test admin backend first so the port is free. Do not use SSH's `-g` option or bind the tunnel to `0.0.0.0`.

In a second local terminal, from frontend:

```bash
npm run admin
```

Open `http://localhost:5174/admin.html`. Keep `VITE_ADMIN_API_URL=` empty; Vite proxies /api/admin to your tunnel. Sign in with the password you set on the **server**, not a separate local test password. The public build is never involved. Disconnecting the tunnel makes admin unavailable; public RSVPs still work.

The local Vite development server can serve the public source too; that does not expose the admin remotely because it is bound to localhost. Do not pass `--host 0.0.0.0` for this admin workflow.

## Before sending invitations

- Confirm date, venue pin, timings, admin-assigned guest allocations, and whether everyone seeing the link is invited to the ceremony.
- Test an attending and declining RSVP through the deployed HTTPS invitation, then verify them in the private dashboard.
- Test at least a small iPhone, Android phone, iPad and desktop browser; test with reduced motion enabled and keyboard-only navigation.
- Check the public API host returns 404 for `/api/admin/data`, `/api/admin/login` and `/api/admin/export/rsvps`.
- Back up SQLite with the included backup CLI and test restoring a copy separately. Back up before replacing a server or disk.
- Verify a restart preserves submitted RSVPs.
- Remove your local test submissions by using a fresh production database. Do not delete a database after real guests have replied.

The form is intentionally open to anyone with the link. Basic throttling and a hidden honeypot reduce simple abuse, but they do not verify invitation ownership. Personal invitation tokens or a CAPTCHA could be added if needed later.


## Email and optional maps

Configure transactional email before promising guests self-service editing: [EMAIL.md](EMAIL.md). Default sender is invitations@selamandkamenju.com; purchase/verify the domain and configure encrypted SMTP first. Real inbox delivery is not certified by automated tests. Initial phone-only RSVPs still work without mail credentials.

Admin uses a revocable HttpOnly JWT cookie. Keep ADMIN_ORIGIN=http://localhost:5174 for the documented local SSH-tunnel workflow and COOKIE_SECURE=false for that local HTTP browser connection. If you build a different HTTPS private admin host, set the exact origin and COOKIE_SECURE=true. Never publicly proxy the admin API; a public proxy can appear as loopback and defeat the network restriction.

The venue card works without Google credentials. Optional cloud styling needs a restricted browser key, billing and Map ID: [MAPS.md](MAPS.md). No blank iframe is shipped.

## Investigating “Failed to fetch”

Check `/api/health` on the **public HTTPS API** first. It checks database connectivity. Confirm your built JavaScript uses your real `VITE_API_URL`, not localhost. Restart/rebuild after environment changes. Set backend `PUBLIC_ORIGIN` to the exact guest origin, and allow OPTIONS and Authorization/Content-Type through your proxy. Keep API TLS valid; an HTTPS frontend cannot call an insecure HTTP backend. Check that persistent SQLite directories are writable. Guest-facing errors stay visible and never become false confirmations.

In local development leave `VITE_API_URL` empty and run Flask on 127.0.0.1:5000; Vite proxies requests. Separate sandboxed previews may not reach a Flask process in another network namespace. Test the deployed same-origin/cross-origin connection on your actual hosting; do not disable CORS or expose the private admin to fix connectivity.
