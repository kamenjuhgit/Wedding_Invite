"""Additive, versioned migration. Never delete a legacy RSVP to make an index fit."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from validation import normalize_phone, normalize_email

SCHEMA = """
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY CHECK(id=1), password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rsvps(id INTEGER PRIMARY KEY, submission_id TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL, phone TEXT NOT NULL, attendance TEXT NOT NULL, guests INTEGER NOT NULL,
 message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visits(id INTEGER PRIMARY KEY,session_id TEXT UNIQUE NOT NULL,
 device TEXT NOT NULL,browser TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY,hits INTEGER,expires INTEGER);
CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS email_otps(id TEXT PRIMARY KEY,rsvp_id INTEGER,identity TEXT NOT NULL,
 code_hash TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,consumed INTEGER NOT NULL DEFAULT 1,revision INTEGER);
CREATE TABLE IF NOT EXISTS guest_sessions(digest TEXT PRIMARY KEY,rsvp_id INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions(jti TEXT PRIMARY KEY,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,action TEXT NOT NULL,rsvp_id INTEGER,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,payload_hash TEXT NOT NULL,rsvp_id INTEGER NOT NULL);
"""


def migrate(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path, timeout=30) as conn:
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE name='rsvps'"
        ).fetchone()
        versions = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE name='schema_versions'"
        ).fetchone()
        done = (
            versions
            and conn.execute("SELECT 1 FROM schema_versions WHERE version=3").fetchone()
        )
        if exists and not done:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
            with sqlite3.connect(
                str(path) + ".before-email-" + stamp + ".bak"
            ) as backup:
                conn.backup(backup)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        conn.execute("BEGIN IMMEDIATE")
        if conn.execute("SELECT 1 FROM schema_versions WHERE version=3").fetchone():
            return
        cols = {r[1] for r in conn.execute("PRAGMA table_info(rsvps)")}
        additions = [
            ("edit_key_hash", "TEXT"),
            ("updated_at", "TEXT"),
            ("revision", "INTEGER NOT NULL DEFAULT 1"),
            ("phone_normalized", "TEXT"),
            ("email", "TEXT"),
            ("email_normalized", "TEXT"),
            ("guest_count", "INTEGER"),
            ("admin_notes", "TEXT NOT NULL DEFAULT ''"),
            ("source", "TEXT NOT NULL DEFAULT 'legacy'"),
            ("migration_issue", "TEXT NOT NULL DEFAULT ''"),
        ]
        for name, declaration in additions:
            if name not in cols:
                conn.execute(f"ALTER TABLE rsvps ADD COLUMN {name} {declaration}")
        if "guest_count" not in cols:
            conn.execute("UPDATE rsvps SET guest_count=guests")
        # Reset canonical fields before rebuilding them, preserving raw legacy values.
        conn.execute(
            "UPDATE rsvps SET phone_normalized=NULL,email_normalized=NULL,edit_key_hash=NULL"
        )
        phones, emails = set(), set()
        for rid, phone, email in conn.execute(
            "SELECT id,phone,email FROM rsvps ORDER BY id"
        ).fetchall():
            issues = []
            canonical_phone = None
            canonical_email = None
            try:
                value = normalize_phone(phone)
                if value in phones:
                    issues.append("Duplicate legacy phone; review with the guest.")
                else:
                    canonical_phone = value
                    phones.add(value)
            except ValueError:
                issues.append("Legacy phone needs review.")
            try:
                value = normalize_email(email, False)
                if value and value in emails:
                    issues.append("Duplicate legacy email; review with the guest.")
                else:
                    canonical_email = value
                    emails.add(value)
            except ValueError:
                issues.append("Legacy email needs review.")
            conn.execute(
                "UPDATE rsvps SET phone_normalized=?,email_normalized=?,migration_issue=? WHERE id=?",
                (canonical_phone, canonical_email, " ".join(issues), rid),
            )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS rsvp_phone_unique ON rsvps(phone_normalized) WHERE phone_normalized IS NOT NULL"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS rsvp_email_unique ON rsvps(email_normalized) WHERE email_normalized IS NOT NULL"
        )
        conn.execute("INSERT INTO schema_versions VALUES(3)")
