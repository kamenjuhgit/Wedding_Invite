"""Public invitation API and loopback-only admin API share persistent SQLite."""

import hashlib
import hmac
import os
import re
import sqlite3
import time
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
import click
import jwt
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash
from database import migrate
from validation import Invalid

load_dotenv(Path(__file__).with_name(".env"))


def create_app(admin=False, test_config=None):
    app = Flask(__name__)
    app.config.update(
        DATABASE=os.getenv(
            "DATABASE_PATH", str(Path(__file__).with_name("data") / "wedding.sqlite3")
        ),
        SECRET_KEY=os.getenv("JWT_SECRET", ""),
        MAX_CONTENT_LENGTH=16384,
        PUBLIC_ORIGIN=os.getenv("PUBLIC_ORIGIN", "http://localhost:5173"),
        ADMIN_ORIGIN=os.getenv("ADMIN_ORIGIN", "http://localhost:5174"),
        COOKIE_SECURE=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        ADMIN_REMEMBER_DAYS=7,
        EMAIL_CHECK_DELIVERABILITY=True,
        MAIL_FROM=os.getenv("MAIL_FROM", "invitations@selamandkamenju.com"),
        MAIL_REPLY_TO=os.getenv("MAIL_REPLY_TO", ""),
        SMTP_HOST=os.getenv("SMTP_HOST", ""),
        SMTP_PORT=int(os.getenv("SMTP_PORT", "587")),
        SMTP_SECURITY=os.getenv("SMTP_SECURITY", "starttls"),
        SMTP_USERNAME=os.getenv("SMTP_USERNAME", ""),
        SMTP_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    )
    if test_config:
        app.config.update(test_config)
    if len(app.config["SECRET_KEY"]) < 32 or app.config["SECRET_KEY"].startswith(
        "REPLACE_"
    ):
        raise RuntimeError(
            "Set JWT_SECRET to a random secret of at least 32 characters. See README."
        )
    if app.config["SMTP_SECURITY"] not in ("ssl", "starttls"):
        raise RuntimeError("SMTP requires ssl or starttls.")
    migrate(app.config["DATABASE"])
    origin = app.config["ADMIN_ORIGIN" if admin else "PUBLIC_ORIGIN"]
    CORS(
        app,
        resources={r"/api/*": {"origins": [origin]}},
        supports_credentials=admin,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    def db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"], timeout=15)
            g.db.row_factory = sqlite3.Row
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        conn = g.pop("db", None)
        if conn:
            conn.close()

    @app.before_request
    def protect_network_and_origin():
        # SSH tunnelling keeps this true even when your database is hosted remotely.
        # Do not put the admin process behind a public proxy (which also appears loopback).
        if admin and request.remote_addr not in ("127.0.0.1", "::1"):
            return jsonify(error="Admin access is restricted to localhost."), 403
        if request.method in ("POST", "PUT", "DELETE") and request.headers.get(
            "Origin"
        ) not in (None, origin):
            return jsonify(error="Origin not allowed."), 403
        if request.method in ("POST", "PUT") and not request.is_json:
            return jsonify(error="Please send a JSON request."), 415

    @app.after_request
    def headers(response):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.errorhandler(Invalid)
    def invalid(error):
        return jsonify(error=str(error), fields={error.field: str(error)}), 400

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="This response is too large."), 413

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error="This little path leads nowhere."), 404

    @app.errorhandler(sqlite3.IntegrityError)
    def conflict(_error):
        return jsonify(
            error="This phone number or email already has an RSVP. Please edit the existing response."
        ), 409

    @app.errorhandler(500)
    def internal_error(_error):
        return jsonify(
            error="Our guestbook needs a moment. Please try again; your save has not been confirmed."
        ), 500

    def body():
        value = request.get_json(silent=True)
        return value if isinstance(value, dict) else {}

    def now_text():
        return datetime.now(timezone.utc).isoformat()

    def digest(value):
        return hmac.new(
            app.config["SECRET_KEY"].encode(), value.encode(), hashlib.sha256
        ).hexdigest()

    def limited(label, maximum, seconds):
        def decorator(fn):
            @wraps(fn)
            def wrapped(*args, **kwargs):
                now = int(time.time())
                bucket = f"{label}:{digest(request.remote_addr or 'unknown')}:{now // seconds}"
                with db():
                    db().execute("DELETE FROM limits WHERE expires<?", (now,))
                    db().execute(
                        "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1",
                        (bucket, (now // seconds + 1) * seconds),
                    )
                    count = (
                        db()
                        .execute("SELECT hits FROM limits WHERE bucket=?", (bucket,))
                        .fetchone()[0]
                    )
                if count > maximum:
                    response = jsonify(
                        error="Too many attempts. Please try again later."
                    )
                    response.headers["Retry-After"] = str(seconds - now % seconds)
                    return response, 429
                return fn(*args, **kwargs)

            return wrapped

        return decorator

    def protected(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            try:
                claims = jwt.decode(
                    request.cookies.get("sk_admin", ""),
                    app.config["SECRET_KEY"],
                    algorithms=["HS256"],
                    audience="wedding-admin",
                    issuer="wedding",
                    options={"require": ["exp", "iat", "sub", "jti"]},
                )
                if (
                    claims["sub"] != "owner"
                    or not db()
                    .execute(
                        "SELECT 1 FROM admin_sessions WHERE jti=? AND expires>?",
                        (claims["jti"], int(time.time())),
                    )
                    .fetchone()
                ):
                    raise jwt.InvalidTokenError()
                g.admin_jti = claims["jti"]
            except jwt.InvalidTokenError:
                return jsonify(
                    error="Your session has ended. Please sign in again."
                ), 401
            return fn(*args, **kwargs)

        return wrapped

    def audit(action, rid):
        db().execute(
            "INSERT INTO audit(action,rsvp_id,created_at) VALUES(?,?,?)",
            (action, rid, now_text()),
        )

    def revoke(rid):
        db().execute("DELETE FROM guest_sessions WHERE rsvp_id=?", (rid,))
        db().execute("UPDATE email_otps SET consumed=1 WHERE rsvp_id=?", (rid,))
        db().execute("UPDATE rsvps SET edit_key_hash=NULL WHERE id=?", (rid,))

    @app.get("/api/health")
    def health():
        db().execute("SELECT 1 FROM rsvps LIMIT 1")
        return jsonify(ok=True)

    # Keep route modules focused: the shared helpers own transactions/authentication.
    from rsvp_routes import install_public, install_admin

    helpers = dict(
        db=db,
        body=body,
        limited=limited,
        digest=digest,
        now_text=now_text,
        protected=protected,
        audit=audit,
        revoke=revoke,
    )
    if admin:
        install_admin(app, **helpers)
    else:
        install_public(app, **helpers)

        @app.post("/api/visit")
        @limited("visit", 120, 3600)
        def visit():
            data = body()
            sid = data.get("session_id", "")
            if (
                data.get("consent") is not True
                or not isinstance(sid, str)
                or not re.fullmatch(r"[a-zA-Z0-9-]{16,64}", sid)
            ):
                return jsonify(error="Invalid visit."), 400
            agent = request.headers.get("User-Agent", "")
            device = (
                "Tablet"
                if "iPad" in agent or ("Android" in agent and "Mobile" not in agent)
                else "Phone"
                if any(x in agent for x in ["iPhone", "Mobile"])
                else "Desktop / other"
            )
            browser = next(
                (
                    n
                    for needle, n in [
                        ("Edg", "Edge"),
                        ("Firefox", "Firefox"),
                        ("Chrome", "Chrome"),
                        ("Safari", "Safari"),
                    ]
                    if needle in agent
                ),
                "Other",
            )
            with db():
                db().execute(
                    "INSERT OR IGNORE INTO visits(session_id,device,browser,created_at) VALUES(?,?,?,?)",
                    (sid, device, browser, now_text()),
                )
            return jsonify(ok=True)

    @app.cli.command("set-admin")
    def set_admin():
        password = click.prompt(
            "New admin password (minimum 14 characters)",
            hide_input=True,
            confirmation_prompt=True,
        )
        if not 14 <= len(password) <= 256:
            raise click.ClickException("Use 14–256 characters.")
        with db():
            db().execute(
                "INSERT INTO admins VALUES(1,?) ON CONFLICT(id) DO UPDATE SET password=excluded.password",
                (generate_password_hash(password),),
            )
            db().execute("DELETE FROM admin_sessions")
        click.echo("Admin password saved; all existing admin sessions revoked.")

    @app.cli.command("backup")
    @click.argument("destination")
    def backup(destination):
        if Path(destination).exists():
            raise click.ClickException("Choose a new backup filename.")
        with sqlite3.connect(destination) as target:
            db().backup(target)
        click.echo("Backup complete. Keep this file private.")

    return app
