"""Integration tests use temporary databases and an in-memory email sender—never real guests."""

import secrets
import sqlite3
import time
import pytest
from werkzeug.security import generate_password_hash
from app import create_app
from validation import normalize_phone, normalize_email, Invalid


@pytest.fixture
def setup(tmp_path):
    outbox = []
    config = {
        "TESTING": True,
        "DATABASE": str(tmp_path / "wedding.sqlite3"),
        "SECRET_KEY": "t" * 48,
        "EMAIL_CHECK_DELIVERABILITY": False,
        "EMAIL_SENDER": lambda email, code: outbox.append((email, code)),
    }
    public = create_app(test_config=config)
    admin = create_app(admin=True, test_config=config)
    with sqlite3.connect(config["DATABASE"]) as c:
        c.execute(
            "INSERT INTO admins VALUES(1,?)",
            (generate_password_hash("test-password-long"),),
        )
    return public.test_client(), admin.test_client(), outbox, config


def payload(**kwargs):
    return dict(
        name="Garden Guest",
        phone="0712345678",
        country="KE",
        email="guest@gmail.com",
        attendance="yes",
        message="",
        consent=True,
        submission_id=secrets.token_hex(32),
        **kwargs,
    )


def submit(p, **changes):
    data = payload()
    data.update(changes)
    return p.post("/api/rsvp", json=data)


def login(a, remember=False):
    return a.post(
        "/api/admin/login",
        json={"password": "test-password-long", "remember": remember},
    )


def verify(p, outbox, phone="0712345678", email="guest@gmail.com"):
    response = p.post("/api/rsvp/otp/request", json={"phone": phone, "email": email})
    assert response.status_code == 202, response.json
    return p.post(
        "/api/rsvp/otp/verify",
        json={"challenge": response.json["challenge"], "code": outbox[-1][1]},
    )


def test_phone_only_and_nullable_email(setup):
    p, a, _, _ = setup
    assert submit(p, email="").status_code == 201
    assert submit(p, phone="0722345678", email="").status_code == 201
    login(a)
    rows = a.get("/api/admin/data").json["rsvps"]
    assert all(r["email"] is None and r["guest_count"] is None for r in rows)


@pytest.mark.parametrize(
    "phone", ["0712345678", "+254712345678", "254712345678", "0712 345 678"]
)
def test_normalization_and_unique_phone(setup, phone):
    p, *_ = setup
    submit(p)
    r = submit(p, phone=phone, email="different@gmail.com")
    assert r.status_code == 409
    assert "phone" in r.json["fields"]


def test_unique_email_case_and_spaces(setup):
    p, *_ = setup
    submit(p)
    r = submit(p, phone="0722345678", email=" Guest@GMAIL.COM ")
    assert r.status_code == 409 and "email" in r.json["fields"]


@pytest.mark.parametrize(
    "phone,country",
    [
        ("+12025550123", "US"),
        ("020 7946 0018", "GB"),
        ("0712345678", "KE"),
        ("0112345678", "KE"),
    ],
)
def test_international_numbers(phone, country):
    assert normalize_phone(phone, country).startswith("+")


@pytest.mark.parametrize(
    "phone", ["123", "+999123456789", "call me", "0712345678 ext 2"]
)
def test_invalid_phone(phone):
    with pytest.raises(Invalid):
        normalize_phone(phone)


@pytest.mark.parametrize("email", ["hello", "a@invalid", "x@@gmail.com"])
def test_invalid_email(email):
    with pytest.raises(Invalid):
        normalize_email(email, False)


@pytest.mark.parametrize("attendance", ["yes", "no", "maybe"])
def test_three_responses_and_no_private_fields(setup, attendance):
    p, *_ = setup
    r = submit(
        p, attendance=attendance, guests=900, guest_count=900, admin_notes="injected"
    )
    assert r.status_code == 201
    assert (
        not {"guests", "guest_count", "admin_notes", "edit_key_hash"}
        & r.json["rsvp"].keys()
    )


def test_no_initial_otp_and_idempotent_retry(setup):
    p, _, box, _ = setup
    data = payload()
    first = p.post("/api/rsvp", json=data)
    second = p.post("/api/rsvp", json=data)
    assert (
        first.status_code == 201
        and second.status_code == 200
        and second.json == {"saved": True, "replayed": True}
    )
    assert not box
    data["name"] = "Different Guest"
    assert p.post("/api/rsvp", json=data).status_code == 409


def test_read_and_edit_need_otp(setup):
    p, *_ = setup
    submit(p)
    assert p.get("/api/rsvp/me").status_code == 401
    assert p.put("/api/rsvp/me", json=payload()).status_code == 401
    assert (
        p.get(
            "/api/rsvp/me", headers={"Authorization": "Bearer " + "a" * 64}
        ).status_code
        == 401
    )


def test_email_edit_preserves_admin_count_and_single_use(setup):
    p, a, box, _ = setup
    submit(p)
    login(a)
    row = a.get("/api/admin/data").json["rsvps"][0]
    r = a.put(
        f"/api/admin/rsvps/{row['id']}",
        json={**row, "guest_count": 4, "admin_notes": "Family allocation"},
    )
    assert r.status_code == 200
    v = verify(p, box)
    assert v.status_code == 200
    assert v.json["expires_in"] == 600
    headers = {"Authorization": "Bearer " + v.json["edit_token"]}
    saved = p.put(
        "/api/rsvp/me",
        headers=headers,
        json={
            **v.json["rsvp"],
            "attendance": "maybe",
            "consent": True,
            "guest_count": 99,
            "admin_notes": "attack",
        },
    )
    assert saved.status_code == 200
    row = a.get("/api/admin/data").json["rsvps"][0]
    assert (
        row["guest_count"] == 4
        and row["admin_notes"] == "Family allocation"
        and row["attendance"] == "maybe"
    )
    assert p.get("/api/rsvp/me", headers=headers).status_code == 401


def test_unknown_contact_and_phone_only_do_not_send(setup):
    p, _, box, _ = setup
    submit(p, email=None)
    r = p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "attacker@gmail.com"},
    )
    assert r.status_code == 202 and not box and "code" not in r.json


def test_five_minute_expiry(setup, monkeypatch):
    p, _, box, _ = setup
    submit(p)
    start = int(time.time())
    monkeypatch.setattr(time, "time", lambda: start)
    r = p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "guest@gmail.com"},
    )
    assert r.json["expires_in"] == 300
    monkeypatch.setattr(time, "time", lambda: start + 300)
    assert (
        p.post(
            "/api/rsvp/otp/verify",
            json={"challenge": r.json["challenge"], "code": box[-1][1]},
        ).status_code
        == 401
    )


def test_five_attempt_lockout(setup):
    p, _, box, _ = setup
    submit(p)
    r = p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "guest@gmail.com"},
    )
    correct = box[-1][1]
    wrong = "9999" if correct != "9999" else "1111"
    for _ in range(5):
        assert (
            p.post(
                "/api/rsvp/otp/verify",
                json={"challenge": r.json["challenge"], "code": wrong},
            ).status_code
            == 401
        )
    assert (
        p.post(
            "/api/rsvp/otp/verify",
            json={"challenge": r.json["challenge"], "code": correct},
        ).status_code
        == 401
    )


def test_resend_cooldown_old_code_invalid_and_single_use(setup, monkeypatch):
    p, _, box, _ = setup
    submit(p)
    start = int(time.time())
    monkeypatch.setattr(time, "time", lambda: start)
    args = {"phone": "0712345678", "email": "guest@gmail.com"}
    first = p.post("/api/rsvp/otp/request", json=args)
    old = box[-1][1]
    assert p.post("/api/rsvp/otp/request", json=args).status_code == 429
    monkeypatch.setattr(time, "time", lambda: start + 31)
    second = p.post("/api/rsvp/otp/request", json=args)
    assert (
        p.post(
            "/api/rsvp/otp/verify",
            json={"challenge": first.json["challenge"], "code": old},
        ).status_code
        == 401
    )
    args = {"challenge": second.json["challenge"], "code": box[-1][1]}
    assert p.post("/api/rsvp/otp/verify", json=args).status_code == 200
    assert p.post("/api/rsvp/otp/verify", json=args).status_code == 401


def test_session_expiry(setup, monkeypatch):
    p, _, box, _ = setup
    submit(p)
    v = verify(p, box)
    start = int(time.time())
    monkeypatch.setattr(time, "time", lambda: start + 601)
    assert (
        p.get(
            "/api/rsvp/me", headers={"Authorization": "Bearer " + v.json["edit_token"]}
        ).status_code
        == 401
    )


def test_mail_failure_and_missing_config(setup):
    p, _, _, _ = setup
    submit(p)
    p.application.config["EMAIL_SENDER"] = None
    assert (
        p.post(
            "/api/rsvp/otp/request",
            json={"phone": "0712345678", "email": "guest@gmail.com"},
        ).status_code
        == 503
    )

    def fail(*args):
        raise RuntimeError("do not expose password")

    p.application.config["EMAIL_SENDER"] = fail
    r = p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "guest@gmail.com"},
    )
    assert r.status_code == 503 and "password" not in r.get_data(as_text=True)


def test_admin_crud_revoke_delete_and_audit(setup):
    p, a, box, _ = setup
    assert a.get("/api/admin/data").status_code == 401
    assert a.post("/api/admin/rsvps", json=payload()).status_code == 401
    assert login(a).status_code == 200
    created = a.post(
        "/api/admin/rsvps",
        json={
            **payload(),
            "attendance": "pending",
            "guest_count": 3,
            "admin_notes": "Private",
        },
    )
    assert created.status_code == 201
    row = created.json["rsvp"]
    rid = row["id"]
    assert row["source"] == "admin" and row["attendance"] == "pending"
    assert a.get(f"/api/admin/rsvps/{rid}").status_code == 200
    assert a.post("/api/admin/rsvps", json=payload()).status_code == 409
    v = verify(p, box)
    headers = {"Authorization": "Bearer " + v.json["edit_token"]}
    assert a.delete(f"/api/admin/rsvps/{rid}", json={"revision": 0}).status_code == 409
    assert (
        a.delete(
            f"/api/admin/rsvps/{rid}", json={"revision": row["revision"]}
        ).status_code
        == 200
    )
    assert p.get("/api/rsvp/me", headers=headers).status_code == 401
    assert not a.get("/api/admin/data").json["rsvps"]
    assert "delete_rsvp" in [
        r["action"] for r in a.get("/api/admin/data").json["audit"]
    ]
    assert submit(p).status_code == 201


def test_admin_login_remember_logout_and_network(setup):
    _, a, _, _ = setup
    r = login(a, True)
    assert (
        "HttpOnly" in r.headers["Set-Cookie"]
        and "Max-Age=604800" in r.headers["Set-Cookie"]
    )
    assert a.get("/api/admin/data").status_code == 200
    assert (
        a.get("/api/admin/data", environ_base={"REMOTE_ADDR": "10.0.0.2"}).status_code
        == 403
    )
    assert a.post("/api/admin/logout", json={}).status_code == 200
    assert a.get("/api/admin/data").status_code == 401


def test_csrf_and_public_admin_separation(setup):
    p, a, _, _ = setup
    login(a)
    assert (
        a.post(
            "/api/admin/rsvps",
            json=payload(),
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert (
        a.delete(
            "/api/admin/rsvps/1", json={}, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert p.get("/api/admin/data").status_code == 404


def test_admin_changes_invalidate_pending_code(setup):
    p, a, box, _ = setup
    submit(p)
    r = p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "guest@gmail.com"},
    )
    login(a)
    row = a.get("/api/admin/data").json["rsvps"][0]
    assert (
        a.put(
            f"/api/admin/rsvps/{row['id']}", json={**row, "name": "Updated Guest"}
        ).status_code
        == 200
    )
    assert (
        p.post(
            "/api/rsvp/otp/verify",
            json={"challenge": r.json["challenge"], "code": box[-1][1]},
        ).status_code
        == 401
    )


def test_migration_backup_preserves_conflicts(tmp_path):
    path = tmp_path / "old.sqlite3"
    with sqlite3.connect(path) as c:
        c.execute(
            "CREATE TABLE rsvps(id INTEGER PRIMARY KEY,submission_id TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,attendance TEXT NOT NULL,guests INTEGER NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL)"
        )
        for i, phone in enumerate(["0712345678", "+254712345678", "bad"], 1):
            c.execute(
                "INSERT INTO rsvps VALUES(?,?,?,?,?,?,?,?)",
                (i, str(i), "Old Guest", phone, "yes", 3, "note", "old"),
            )
    create_app(
        test_config={"TESTING": True, "DATABASE": str(path), "SECRET_KEY": "x" * 40}
    )
    with sqlite3.connect(path) as c:
        rows = c.execute(
            "SELECT guest_count,migration_issue FROM rsvps ORDER BY id"
        ).fetchall()
    assert len(rows) == 3 and all(r[0] == 3 for r in rows) and rows[1][1] and rows[2][1]
    assert len(list(tmp_path.glob("*.bak"))) == 1
    create_app(
        test_config={"TESTING": True, "DATABASE": str(path), "SECRET_KEY": "x" * 40}
    )
    assert len(list(tmp_path.glob("*.bak"))) == 1


def test_visit_consent_and_csv_formula_safety(setup):
    p, a, _, _ = setup
    assert p.post("/api/visit", json={"session_id": "a" * 32}).status_code == 400
    assert (
        p.post("/api/visit", json={"session_id": "a" * 32, "consent": True}).status_code
        == 200
    )
    submit(p, name='=HYPERLINK("evil")')
    login(a)
    assert "'=HYPERLINK" in a.get("/api/admin/export/rsvps").get_data(as_text=True)


def test_contact_changes_and_private_counts_survive(setup):
    p, a, box, _ = setup
    submit(p)
    login(a)
    row = a.get("/api/admin/data").json["rsvps"][0]
    a.put(f"/api/admin/rsvps/{row['id']}", json={**row, "guest_count": 5})
    v = verify(p, box)
    r = p.put(
        "/api/rsvp/me",
        json={
            **v.json["rsvp"],
            "phone": "+12025550123",
            "email": "newguest@gmail.com",
            "attendance": "no",
            "consent": True,
        },
        headers={"Authorization": "Bearer " + v.json["edit_token"]},
    )
    assert r.status_code == 200
    row = a.get("/api/admin/data").json["rsvps"][0]
    assert (
        row["phone"] == "+12025550123"
        and row["email"] == "newguest@gmail.com"
        and row["guest_count"] == 5
    )


def test_admin_revoke_while_mail_is_in_flight_does_not_activate_code(setup):
    p, a, box, _ = setup
    submit(p)
    login(a)
    rid = a.get("/api/admin/data").json["rsvps"][0]["id"]

    def sender(email, code):
        box.append((email, code))
        assert a.post(f"/api/admin/rsvps/{rid}/revoke", json={}).status_code == 200

    p.application.config["EMAIL_SENDER"] = sender
    request = p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "guest@gmail.com"},
    )
    assert (
        p.post(
            "/api/rsvp/otp/verify",
            json={"challenge": request.json["challenge"], "code": box[-1][1]},
        ).status_code
        == 401
    )


def test_concurrent_duplicate_writes(setup):
    from concurrent.futures import ThreadPoolExecutor

    p, _, _, _ = setup

    def write(_):
        with p.application.test_client() as client:
            return submit(client).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(write, range(2)))
    assert sorted(codes) == [201, 409]


def test_api_key_is_not_in_config_and_code_is_hashed(setup):
    p, _, box, cfg = setup
    submit(p)
    p.post(
        "/api/rsvp/otp/request",
        json={"phone": "0712345678", "email": "guest@gmail.com"},
    )
    with sqlite3.connect(cfg["DATABASE"]) as c:
        stored = c.execute("SELECT code_hash FROM email_otps").fetchone()[0]
    assert stored != box[-1][1] and len(stored) == 64
    assert set(p.get("/api/config").json) == {
        "email_available",
        "edit_requires_otp",
        "otp_seconds",
    }


def test_smtp_sender_and_tls_contract(setup, monkeypatch):
    import mailer

    p, _, _, _ = setup
    app = p.application
    app.config.update(
        EMAIL_SENDER=None,
        SMTP_HOST="mail.provider.example",
        SMTP_USERNAME="user",
        SMTP_PASSWORD="secret",
    )
    events = []

    class FakeSMTP:
        def __init__(self, **kwargs):
            events.append(("connect", kwargs["port"]))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self, context):
            events.append(("tls", context.check_hostname))

        def login(self, user, password):
            events.append(("login", user))

        def send_message(self, message):
            assert "invitations@selamandkamenju.com" in message["From"]
            assert message["To"] == "guest@gmail.com"
            assert "4821" in message.get_body(preferencelist=("plain",)).get_content()
            assert (
                "5 minutes" in message.get_body(preferencelist=("plain",)).get_content()
            )
            return {}

    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    mailer.send_code(app, "guest@gmail.com", "4821")
    assert events == [("connect", 587), ("tls", True), ("login", "user")]


def test_email_dns_unknown_is_not_silently_accepted(monkeypatch):
    import validation
    from types import SimpleNamespace

    monkeypatch.setattr(
        validation,
        "validate_email",
        lambda *args, **kwargs: SimpleNamespace(normalized="guest@gmail.com"),
    )
    with pytest.raises(Invalid):
        validation.normalize_email("guest@gmail.com", True)
