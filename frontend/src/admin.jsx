import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Monogram from "./Monogram";
import ContactFields, { contactErrors } from "./ContactFields";
import ErrorCard, { InvitationBoundary } from "./ErrorCard";
import { api } from "./api";
import "./admin-base.css";
import "./admin.css";
import "./rsvp-updates.css";
const API = import.meta.env.VITE_ADMIN_API_URL || "";
const labels = {
  yes: "Attending",
  no: "Not attending",
  maybe: "Not sure yet",
  pending: "Awaiting response",
};
const blank = {
  name: "",
  country: "KE",
  phone: "",
  email: "",
  attendance: "pending",
  guest_count: "",
  message: "",
  admin_notes: "",
};
const call = (path, options = {}) =>
  api(API, path, { ...options, credentials: "include" });
function Admin() {
  const [signed, setSigned] = useState(false),
    [checking, setChecking] = useState(true),
    [data, setData] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [tab, setTab] = useState("rsvps");
  const [showPassword, setShowPassword] = useState(false),
    [editor, setEditor] = useState(null),
    [errors, setErrors] = useState({}),
    [deleting, setDeleting] = useState(null);
  function failed(e) {
    setError(e.message);
    if (e.status === 401) {
      setSigned(false);
      setData(null);
      setEditor(null);
      setDeleting(null);
    }
  }
  async function refresh(initial = false) {
    try {
      setData(await call("/api/admin/data"));
      setSigned(true);
    } catch (e) {
      if (!initial || e.status !== 401) failed(e);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    refresh(true);
  }, []);
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await call("/api/admin/login", {
        method: "POST",
        body: {
          password: form.get("password"),
          remember: form.get("remember") === "on",
        },
      });
      await refresh();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await call("/api/admin/logout", { method: "POST", body: {} });
      setSigned(false);
      setData(null);
      setEditor(null);
      setDeleting(null);
      setNotice("");
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    const invalid = contactErrors(editor);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    setError("");
    try {
      await call(
        editor.id ? `/api/admin/rsvps/${editor.id}` : "/api/admin/rsvps",
        {
          method: editor.id ? "PUT" : "POST",
          body: {
            ...editor,
            guest_count:
              editor.guest_count === "" ? null : Number(editor.guest_count),
          },
        },
      );
      setEditor(null);
      setNotice("Guest record saved.");
      await refresh();
    } catch (e) {
      failed(e);
      setErrors(e.fields || {});
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/admin/rsvps/${deleting.id}`, {
        method: "DELETE",
        body: { revision: deleting.revision },
      });
      setDeleting(null);
      setNotice("RSVP deleted and editing access revoked.");
      await refresh();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    try {
      const blob = await call(`/api/admin/export/${tab}`, { raw: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wedding-${tab}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      failed(e);
    }
  }
  const guests = data?.rsvps || [];
  const yes = guests.filter((r) => r.attendance === "yes"),
    maybe = guests.filter((r) => r.attendance === "maybe");
  const rows = (data?.[tab] || []).filter(
    (r) =>
      (tab !== "rsvps" || filter === "all" || r.attendance === filter) &&
      Object.values(r).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
  );
  const change = (e) =>
    setEditor((f) => ({ ...f, [e.target.name]: e.target.value }));
  return (
    <main className="admin-shell">
      <header className="admin-heading">
        <div>
          <Monogram size={65} />
          <span className="eyebrow">Selam & Kamenju / Private guestbook</span>
          <h1>Our people.</h1>
          <p>Every reply, one lovely celebration.</p>
        </div>
        {signed && (
          <button className="button outline" disabled={busy} onClick={logout}>
            Sign out
          </button>
        )}
      </header>
      <ErrorCard message={error} />
      {notice && <p role="status">{notice}</p>}
      {checking ? (
        <p role="status">Opening your guestbook…</p>
      ) : !signed ? (
        <form className="login-card" onSubmit={login}>
          <h2>A little privacy.</h2>
          <p>Sign in to manage your guestbook.</p>
          <label>
            Administrator
            <input
              name="username"
              autoComplete="username"
              value="owner"
              readOnly
            />
          </label>
          <label htmlFor="admin-password">Admin password</label>
          <div className="password-row">
            <input
              id="admin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={256}
            />
            <button
              type="button"
              aria-controls="admin-password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((p) => !p)}
            >
              {showPassword ? "Hide" : "Show"} password
            </button>
          </div>
          <label className="remember">
            <input type="checkbox" name="remember" />
            Keep me signed in on this device for 7 days
          </label>
          <button className="button dark" disabled={busy}>
            {busy ? "Signing in…" : "Open guestbook ↗"}
          </button>
          <small>
            Your browser can offer to save this login in its password manager.
          </small>
        </form>
      ) : (
        <>
          <section className="stats" aria-label="Wedding totals">
            {[
              ["RSVP records", guests.length],
              ["Attending responses", yes.length],
              [
                "Confirmed people",
                yes.reduce((n, r) => n + (r.guest_count || 0), 0),
              ],
              [
                "Attending: count unassigned",
                yes.filter((r) => r.guest_count === null).length,
              ],
              ["Not sure yet", maybe.length],
              [
                "Tentative people",
                maybe.reduce((n, r) => n + (r.guest_count || 0), 0),
              ],
              [
                "Not attending",
                guests.filter((r) => r.attendance === "no").length,
              ],
              [
                "Awaiting response",
                guests.filter((r) => r.attendance === "pending").length,
              ],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </article>
            ))}
          </section>
          <div className="admin-toolbar">
            <div className="admin-tabs">
              {[
                ["rsvps", "RSVPs"],
                ["visits", "Visit statistics"],
                ["audit", "Admin history"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={tab === value}
                  onClick={() => {
                    setTab(value);
                    setQuery("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              <button disabled={busy} onClick={() => refresh()}>
                Refresh
              </button>
              <button disabled={busy} onClick={download}>
                Export {tab}
              </button>
              <button
                className="button dark"
                disabled={busy}
                onClick={() => {
                  setEditor({ ...blank });
                  setErrors({});
                  setError("");
                  setDeleting(null);
                }}
              >
                Add Guest
              </button>
            </div>
          </div>
          {editor && (
            <section className="admin-editor" aria-label="Guest editor">
              <h2>
                {editor.id ? "Edit guest" : "A new place in our guestbook"}
              </h2>
              <form onSubmit={save}>
                <label>
                  Full name
                  <input
                    autoFocus
                    name="name"
                    value={editor.name}
                    onChange={change}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <ContactFields
                  prefix="admin"
                  values={editor}
                  onChange={setEditor}
                  errors={errors}
                />
                <label>
                  Response
                  <select
                    name="attendance"
                    value={editor.attendance}
                    onChange={change}
                  >
                    {Object.entries(labels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assigned people, including this guest (admin only)
                  <input
                    type="number"
                    name="guest_count"
                    min={0}
                    max={1000}
                    step={1}
                    value={editor.guest_count}
                    onChange={change}
                    placeholder="Not assigned"
                  />
                  <small>
                    Leave blank until you confirm the allocation. Guest edits
                    cannot change it.
                  </small>
                </label>
                <label>
                  Guest’s note
                  <textarea
                    name="message"
                    value={editor.message}
                    maxLength={500}
                    onChange={change}
                  />
                </label>
                <label>
                  Private admin notes
                  <textarea
                    name="admin_notes"
                    value={editor.admin_notes}
                    maxLength={2000}
                    onChange={change}
                  />
                </label>
                <button className="button dark" disabled={busy}>
                  {busy ? "Saving…" : "Save guest"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
              </form>
            </section>
          )}
          {deleting && (
            <section
              className="delete-confirmation"
              role="alert"
              aria-label="Confirm RSVP deletion"
            >
              <h2>Delete this RSVP?</h2>
              <p>
                <strong>{deleting.name}</strong>
                <br />
                {deleting.phone}
              </p>
              <p>
                This removes their response and revokes editing access. This
                cannot be undone in the dashboard.
              </p>
              <button
                autoFocus
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button className="button dark" disabled={busy} onClick={remove}>
                Delete RSVP
              </button>
            </section>
          )}
          <div className="filters">
            <label>
              Search
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records…"
              />
            </label>
            {tab === "rsvps" && (
              <label>
                Response
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All responses</option>
                  {Object.entries(labels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="small">
            {tab === "rsvps"
              ? "Assigned people are private to admin. Blank counts are not included in people totals. Review any migration warnings before relying on totals."
              : tab === "visits"
                ? "Optional, anonymous sessions—not unique people or a complete visitor census."
                : "Latest 500 admin actions. CSV export contains the full history."}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(tab === "rsvps"
                    ? [
                        "Name",
                        "Phone",
                        "Email",
                        "Response",
                        "Assigned people",
                        "Notes / review",
                        "Source",
                        "Actions",
                      ]
                    : tab === "visits"
                      ? ["Record", "Device", "Browser", "Visited"]
                      : ["Record", "Action", "RSVP ID", "When"]
                  ).map((l) => (
                    <th key={l}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {tab === "rsvps" ? (
                      <>
                        <td>{row.name}</td>
                        <td>{row.phone}</td>
                        <td>{row.email || "Not supplied"}</td>
                        <td>
                          <span className={`badge ${row.attendance}`}>
                            {labels[row.attendance]}
                          </span>
                        </td>
                        <td>{row.guest_count ?? "Not assigned"}</td>
                        <td className="note-cell">
                          {row.message && <p>Guest: {row.message}</p>}
                          {row.admin_notes && <p>Private: {row.admin_notes}</p>}
                          {row.migration_issue && (
                            <p className="field-error">{row.migration_issue}</p>
                          )}
                        </td>
                        <td>
                          {row.source === "admin"
                            ? "Added by admin"
                            : row.source === "legacy"
                              ? "Existing RSVP"
                              : "Guest"}
                        </td>
                        <td>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setEditor({
                                ...blank,
                                ...row,
                                email: row.email || "",
                                guest_count: row.guest_count ?? "",
                              });
                              setErrors({});
                              setError("");
                              setDeleting(null);
                            }}
                          >
                            View / Edit
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setDeleting(row);
                              setEditor(null);
                            }}
                          >
                            Delete
                          </button>
                          <button
                            disabled={busy}
                            onClick={async () => {
                              try {
                                await call(
                                  `/api/admin/rsvps/${row.id}/revoke`,
                                  { method: "POST", body: {} },
                                );
                                setNotice(
                                  "Editing access revoked. A fresh OTP is required.",
                                );
                                await refresh();
                              } catch (e) {
                                failed(e);
                              }
                            }}
                          >
                            Revoke edit access
                          </button>
                        </td>
                      </>
                    ) : tab === "visits" ? (
                      <>
                        <td>{row.id}</td>
                        <td>{row.device}</td>
                        <td>{row.browser}</td>
                        <td>{new Date(row.created_at).toLocaleString()}</td>
                      </>
                    ) : (
                      <>
                        <td>{row.id}</td>
                        <td>{row.action}</td>
                        <td>{row.rsvp_id ?? "—"}</td>
                        <td>{new Date(row.created_at).toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="empty">No records to show.</p>}
          </div>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(
  <InvitationBoundary>
    <Admin />
  </InvitationBoundary>,
);
