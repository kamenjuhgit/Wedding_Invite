"""RSVP writes, single-use email verification, and authenticated admin CRUD."""

import csv
import hmac
import io
import json
import re
import secrets
import time
import jwt
from flask import Response, g, jsonify, request
from werkzeug.security import check_password_hash
from validation import fields, normalize_phone, normalize_email, Invalid
from mailer import ready, send_code

PUBLIC_FIELDS = ("name", "phone", "email", "attendance", "message", "revision")
ADMIN_FIELDS = (
    "id",
    "name",
    "phone",
    "email",
    "attendance",
    "guest_count",
    "message",
    "admin_notes",
    "source",
    "migration_issue",
    "created_at",
    "updated_at",
    "revision",
)


def public_data(row):
    return {key: row[key] for key in PUBLIC_FIELDS}


def admin_data(row):
    return {key: row[key] for key in ADMIN_FIELDS}


def duplicate(conn, values, exclude=None):
    # Include unresolved legacy duplicates whose canonical columns were left NULL.
    for row in conn.execute("SELECT id,phone,email FROM rsvps"):
        if row["id"] == exclude:
            continue
        try:
            phone = normalize_phone(row["phone"])
        except ValueError:
            phone = None
        try:
            email = normalize_email(row["email"], False)
        except ValueError:
            email = None
        if phone == values["phone"]:
            return jsonify(
                error="This phone number has already RSVP’d.",
                fields={"phone": "This phone number has already RSVP’d."},
                duplicate=True,
            ), 409
        if values["email"] and email == values["email"]:
            return jsonify(
                error="This email address has already RSVP’d.",
                fields={"email": "This email address has already RSVP’d."},
                duplicate=True,
            ), 409
    return None


def insert(conn, values, submission, created, source):
    keys = [
        "submission_id",
        "name",
        "phone",
        "phone_normalized",
        "email",
        "email_normalized",
        "attendance",
        "guests",
        "guest_count",
        "message",
        "admin_notes",
        "created_at",
        "source",
    ]
    args = [
        submission,
        values["name"],
        values["phone"],
        values["phone"],
        values["email"],
        values["email"],
        values["attendance"],
        0,
        values.get("guest_count"),
        values["message"],
        values.get("admin_notes", ""),
        created,
        source,
    ]
    return conn.execute(
        f"INSERT INTO rsvps({','.join(keys)}) VALUES({','.join('?' for _ in keys)})",
        args,
    ).lastrowid


def update(conn, rid, values, edited, admin=False):
    # Public updates deliberately exclude guest_count and private notes.
    keys = ["name", "phone", "email", "attendance", "message"] + (
        ["guest_count", "admin_notes"] if admin else []
    )
    conn.execute(
        f"UPDATE rsvps SET {','.join(k + '=?' for k in keys)},phone_normalized=?,email_normalized=?,updated_at=?,revision=revision+1,migration_issue='' WHERE id=?",
        [values[k] for k in keys] + [values["phone"], values["email"], edited, rid],
    )


def install_public(app, db, body, limited, digest, now_text, revoke, **_helpers):
    def guest():
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if not re.fullmatch(r"[a-f0-9]{64}", token):
            return None
        return (
            db()
            .execute(
                "SELECT r.* FROM guest_sessions s JOIN rsvps r ON r.id=s.rsvp_id WHERE s.digest=? AND s.expires>?",
                (digest(token), int(time.time())),
            )
            .fetchone()
        )

    @app.get("/api/config")
    def config():
        return jsonify(
            email_available=ready(app), edit_requires_otp=True, otp_seconds=300
        )

    @app.get("/api/rsvp/me")
    @limited("read", 120, 3600)
    def read():
        row = guest()
        if not row:
            return jsonify(error="Verify a fresh email code to access your RSVP."), 401
        return jsonify(rsvp=public_data(row))

    @app.post("/api/rsvp")
    @app.put("/api/rsvp/me")
    @limited("rsvp", 30, 3600)
    def save():
        data = body()
        if data.get("website"):
            return jsonify(error="We could not accept this response."), 400
        if data.get("consent") is not True:
            raise Invalid(
                "consent", "Please agree to share these details with the couple."
            )
        values = fields(data, check_dns=app.config["EMAIL_CHECK_DELIVERABILITY"])
        sid = data.get("submission_id", "")
        if request.method == "POST" and (
            not isinstance(sid, str) or not re.fullmatch(r"[a-zA-Z0-9-]{32,64}", sid)
        ):
            return jsonify(error="Please refresh the form before submitting."), 400
        payload = digest(json.dumps(values, sort_keys=True))
        conn = db()
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            owned = guest() if request.method == "PUT" else None
            if request.method == "PUT" and not owned:
                return jsonify(
                    error="Your editing session has ended. Request a new email code."
                ), 401
            if owned and (
                type(data.get("revision")) is not int
                or data["revision"] != owned["revision"]
            ):
                return jsonify(
                    error="This response was updated elsewhere. Verify again to load the latest details."
                ), 409
            if request.method == "POST":
                previous = conn.execute(
                    "SELECT * FROM submissions WHERE id=?", (sid,)
                ).fetchone()
                if previous:
                    if not hmac.compare_digest(previous["payload_hash"], payload):
                        return jsonify(
                            error="Your earlier submission was saved. Use Edit My RSVP to make changes."
                        ), 409
                    # A network retry acknowledges the same payload, never reads personal data.
                    return jsonify(saved=True, replayed=True), 200
            conflict = duplicate(conn, values, owned["id"] if owned else None)
            if conflict:
                return conflict
            if owned:
                rid = owned["id"]
                update(conn, rid, values, now_text())
                revoke(rid)
            else:
                rid = insert(conn, values, sid, now_text(), "guest")
                conn.execute(
                    "INSERT INTO submissions VALUES(?,?,?)", (sid, payload, rid)
                )
            row = conn.execute("SELECT * FROM rsvps WHERE id=?", (rid,)).fetchone()
        return jsonify(saved=True, rsvp=public_data(row)), 200 if owned else 201

    @app.post("/api/rsvp/edit/logout")
    def end_edit():
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        with db():
            db().execute("DELETE FROM guest_sessions WHERE digest=?", (digest(token),))
        return jsonify(ok=True)

    @app.post("/api/rsvp/otp/request")
    @limited("otp-send", 10, 900)
    def request_code():
        if not ready(app):
            return jsonify(
                error="Email editing is not available yet. Please contact Selam or Kamenju for changes."
            ), 503
        data = body()
        phone = normalize_phone(data.get("phone"), data.get("country", "KE"))
        email = normalize_email(data.get("email"), False)
        if not email:
            raise Invalid("email", "Enter the email registered with your RSVP.")
        now = int(time.time())
        identity = digest(email)
        conn = db()
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM email_otps WHERE created<?", (now - 86400,))
            last = conn.execute(
                "SELECT MAX(created) FROM email_otps WHERE identity=?", (identity,)
            ).fetchone()[0]
            if last is not None and now - last < 30:
                return jsonify(
                    error="Please wait 30 seconds before requesting another code."
                ), 429
            recent = conn.execute(
                "SELECT COUNT(*) FROM email_otps WHERE identity=? AND created>?",
                (identity, now - 900),
            ).fetchone()[0]
            daily = conn.execute(
                "SELECT COUNT(*) FROM email_otps WHERE identity=?", (identity,)
            ).fetchone()[0]
            total = conn.execute("SELECT COUNT(*) FROM email_otps").fetchone()[0]
            if recent >= 3 or daily >= 10 or total >= 1000:
                return jsonify(
                    error="The verification request limit has been reached. Please try later or contact the couple."
                ), 429
            matches = []
            for row in conn.execute("SELECT * FROM rsvps"):
                try:
                    if (
                        normalize_phone(row["phone"]) == phone
                        and normalize_email(row["email"], False) == email
                    ):
                        matches.append(row)
                except ValueError:
                    pass
            row = matches[0] if len(matches) == 1 else None
            # Same response for unknown contacts; never disclose whether a mailbox has a guest.
            cid = secrets.token_hex(24)
            code = f"{secrets.randbelow(10000):04d}"
            conn.execute(
                "UPDATE email_otps SET consumed=1 WHERE identity=?", (identity,)
            )
            conn.execute(
                "INSERT INTO email_otps(id,rsvp_id,identity,code_hash,created,expires,revision,consumed) VALUES(?,?,?,?,?,?,?,2)",
                (
                    cid,
                    row["id"] if row else None,
                    identity,
                    digest(cid + code),
                    now,
                    now + 300,
                    row["revision"] if row else None,
                ),
            )
        if row:
            try:
                send_code(app, row["email"], code)
            except Exception:
                # Never log SMTP payloads, secrets, codes or recipient addresses.
                return jsonify(
                    error="We couldn’t send your code just now. Please wait a moment and try again."
                ), 503
            with conn:
                newest = conn.execute(
                    "SELECT id FROM email_otps WHERE identity=? ORDER BY rowid DESC LIMIT 1",
                    (identity,),
                ).fetchone()
                if newest and newest["id"] == cid:
                    conn.execute(
                        "UPDATE email_otps SET consumed=0 WHERE id=? AND consumed=2",
                        (cid,),
                    )
        return jsonify(
            challenge=cid,
            expires_in=300,
            resend_after=30,
            message="If those details match an RSVP with an email, a code has been requested. Check your inbox and spam folder.",
        ), 202

    @app.post("/api/rsvp/otp/verify")
    @limited("otp-verify", 30, 900)
    def verify():
        data = body()
        cid = data.get("challenge", "")
        code = data.get("code", "")
        if (
            not isinstance(cid, str)
            or len(cid) > 100
            or not isinstance(code, str)
            or not re.fullmatch(r"[0-9]{4}", code)
        ):
            raise Invalid("code", "Enter the four-digit email code.")
        conn = db()
        now = int(time.time())
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            challenge = conn.execute(
                "SELECT * FROM email_otps WHERE id=?", (cid,)
            ).fetchone()
            if (
                not challenge
                or challenge["consumed"]
                or challenge["expires"] <= now
                or challenge["attempts"] >= 5
            ):
                return jsonify(
                    error="This code has expired or is unavailable. Please request a new one."
                ), 401
            conn.execute("UPDATE email_otps SET attempts=attempts+1 WHERE id=?", (cid,))
            if not hmac.compare_digest(challenge["code_hash"], digest(cid + code)):
                return jsonify(
                    error="That code doesn’t match. Please check your email and try again."
                ), 401
            conn.execute("UPDATE email_otps SET consumed=1 WHERE id=?", (cid,))
            row = conn.execute(
                "SELECT * FROM rsvps WHERE id=?", (challenge["rsvp_id"],)
            ).fetchone()
            if not row or row["revision"] != challenge["revision"]:
                return jsonify(
                    error="This response changed while you were verifying. Please request a new code."
                ), 409
            revoke(row["id"])
            token = secrets.token_hex(32)
            conn.execute("DELETE FROM guest_sessions WHERE expires<=?", (now,))
            conn.execute(
                "INSERT INTO guest_sessions VALUES(?,?,?)",
                (digest(token), row["id"], now + 600),
            )
        return jsonify(rsvp=public_data(row), edit_token=token, expires_in=600)


def install_admin(
    app, db, body, limited, protected, now_text, audit, revoke, **_helpers
):
    @app.post("/api/admin/login")
    @limited("login", 5, 900)
    def login():
        data = body()
        password = data.get("password", "")
        row = db().execute("SELECT password FROM admins WHERE id=1").fetchone()
        if (
            not isinstance(password, str)
            or len(password) > 256
            or not row
            or not check_password_hash(row["password"], password)
        ):
            return jsonify(error="Incorrect password or admin not configured."), 401
        remember = data.get("remember") is True
        duration = app.config["ADMIN_REMEMBER_DAYS"] * 86400 if remember else 1800
        now = int(time.time())
        jti = secrets.token_hex(32)
        token = jwt.encode(
            dict(
                sub="owner",
                iat=now,
                exp=now + duration,
                aud="wedding-admin",
                iss="wedding",
                jti=jti,
            ),
            app.config["SECRET_KEY"],
            algorithm="HS256",
        )
        with db():
            db().execute("DELETE FROM admin_sessions WHERE expires<=?", (now,))
            db().execute(
                "INSERT INTO admin_sessions VALUES(?,?)", (jti, now + duration)
            )
            audit("admin_login", None)
        response = jsonify(ok=True, expires_in=duration)
        response.set_cookie(
            "sk_admin",
            token,
            max_age=duration if remember else None,
            httponly=True,
            secure=app.config["COOKIE_SECURE"],
            samesite="Strict",
            path="/api/admin",
        )
        return response

    @app.post("/api/admin/logout")
    @protected
    def logout():
        with db():
            db().execute("DELETE FROM admin_sessions WHERE jti=?", (g.admin_jti,))
            audit("admin_logout", None)
        response = jsonify(ok=True)
        response.delete_cookie(
            "sk_admin",
            path="/api/admin",
            samesite="Strict",
            secure=app.config["COOKIE_SECURE"],
        )
        return response

    @app.get("/api/admin/data")
    @protected
    def dashboard():
        return jsonify(
            rsvps=[
                admin_data(r)
                for r in db().execute("SELECT * FROM rsvps ORDER BY id DESC")
            ],
            visits=[
                dict(r)
                for r in db().execute(
                    "SELECT id,device,browser,created_at FROM visits ORDER BY id DESC"
                )
            ],
            audit=[
                dict(r)
                for r in db().execute("SELECT * FROM audit ORDER BY id DESC LIMIT 500")
            ],
        )

    @app.get("/api/admin/rsvps/<int:rid>")
    @protected
    def detail(rid):
        row = db().execute("SELECT * FROM rsvps WHERE id=?", (rid,)).fetchone()
        return (
            (jsonify(rsvp=admin_data(row)), 200)
            if row
            else (jsonify(error="RSVP not found."), 404)
        )

    @app.post("/api/admin/rsvps")
    @app.put("/api/admin/rsvps/<int:rid>")
    @protected
    def save(rid=None):
        data = body()
        values = fields(
            data, admin=True, check_dns=app.config["EMAIL_CHECK_DELIVERABILITY"]
        )
        conn = db()
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            row = (
                conn.execute("SELECT * FROM rsvps WHERE id=?", (rid,)).fetchone()
                if rid
                else None
            )
            if rid and not row:
                return jsonify(error="RSVP not found."), 404
            if row and (
                type(data.get("revision")) is not int
                or data["revision"] != row["revision"]
            ):
                return jsonify(
                    error="This record changed. Close the editor and reload it before saving."
                ), 409
            conflict = duplicate(conn, values, rid)
            if conflict:
                return conflict
            if row:
                update(conn, rid, values, now_text(), True)
                revoke(rid)
                audit("update_rsvp", rid)
            else:
                rid = insert(conn, values, secrets.token_hex(32), now_text(), "admin")
                audit("create_rsvp", rid)
            result = admin_data(
                conn.execute("SELECT * FROM rsvps WHERE id=?", (rid,)).fetchone()
            )
        return jsonify(rsvp=result), 200 if row else 201

    @app.delete("/api/admin/rsvps/<int:rid>")
    @protected
    def delete(rid):
        conn = db()
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute(
                "SELECT revision FROM rsvps WHERE id=?", (rid,)
            ).fetchone()
            if not row:
                return jsonify(error="RSVP not found."), 404
            if body().get("revision") != row["revision"]:
                return jsonify(
                    error="This record changed. Refresh before deleting."
                ), 409
            revoke(rid)
            conn.execute("DELETE FROM submissions WHERE rsvp_id=?", (rid,))
            conn.execute("DELETE FROM email_otps WHERE rsvp_id=?", (rid,))
            conn.execute("DELETE FROM rsvps WHERE id=?", (rid,))
            audit("delete_rsvp", rid)
        return jsonify(ok=True)

    @app.post("/api/admin/rsvps/<int:rid>/revoke")
    @protected
    def revoke_access(rid):
        if not db().execute("SELECT 1 FROM rsvps WHERE id=?", (rid,)).fetchone():
            return jsonify(error="RSVP not found."), 404
        with db():
            revoke(rid)
            audit("revoke_edit_access", rid)
        return jsonify(ok=True)

    @app.get("/api/admin/export/<kind>")
    @protected
    def export(kind):
        columns = {
            "rsvps": ADMIN_FIELDS,
            "visits": ("id", "device", "browser", "created_at"),
            "audit": ("id", "action", "rsvp_id", "created_at"),
        }
        if kind not in columns:
            return jsonify(error="Unknown export."), 404
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(columns[kind])

        def safe(v):
            return (
                "'" + v
                if isinstance(v, str)
                and v.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n"))
                else v
            )

        writer.writerows(
            [
                [safe(row[key]) for key in columns[kind]]
                for row in db().execute(f"SELECT * FROM {kind} ORDER BY id DESC")
            ]
        )
        return Response(
            "\ufeff" + output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={kind}.csv"},
        )
