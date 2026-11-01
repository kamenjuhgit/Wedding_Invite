import React, { useEffect, useRef, useState } from "react";
import { api, API_BASE } from "./api";
import OTPAccess from "./OTPAccess";
import RSVPConfirmation from "./RSVPConfirmation";
import ContactFields, { contactErrors } from "./ContactFields";
import ErrorCard from "./ErrorCard";
import { useOutIn } from "./Transition";
import { RECEIPT_KEY, receiptFor, parseReceipt } from "./rsvpReceipt";
const EMPTY = {
  name: "",
  country: "KE",
  phone: "",
  email: "",
  attendance: "yes",
  message: "",
};
const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage is optional, never authentication. */
  }
};
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export default function RSVP() {
  const [fields, setFields] = useState(EMPTY),
    [record, setRecord] = useState(() => parseReceipt(read(RECEIPT_KEY)));
  const [mode, setMode, leaving] = useOutIn(
    parseReceipt(read(RECEIPT_KEY))
      ? "saved"
      : "new",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState({});
  const [token, setToken] = useState("");
  const [verifyAgain, setVerifyAgain] = useState(false);
  const [expires, setExpires] = useState(0),
    [now, setNow] = useState(Date.now());
  const submission = useRef(read("sk-email-submission") || random());
  // Session tokens remain only in memory: refreshing requires a new email OTP.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      localStorage.removeItem("sk-v2-edit-key");
      localStorage.removeItem("sk-v2-submitted");
      localStorage.removeItem("sk-rsvp-receipt-v1");
    } catch {}
  }, []);
  async function endEdit() {
    if (token)
      api(API_BASE, "/api/rsvp/edit/logout", {
        method: "POST",
        body: {},
        token,
      }).catch(() => {});
    setToken("");
    setMode(record ? "saved" : "new");
    setError("");
  }
  function startNew() {
    // A shared device is not a guest identity. Start a separate POST, never an edit.
    if (busy) return;
    if (token) api(API_BASE, "/api/rsvp/edit/logout", {
      method: "POST", body: {}, token,
    }).catch(() => {});
    setToken("");
    setRecord(null);
    setFields({ ...EMPTY });
    setErrors({});
    setError("");
    setVerifyAgain(false);
    setExpires(0);
    // Rotate the retry key so the next person's response is not replayed as the first.
    submission.current = random();
    store("sk-email-submission", submission.current);
    try { localStorage.removeItem(RECEIPT_KEY); } catch {}
    setMode("new");
  }
  function verify() {
    setToken("");
    setError("");
    setErrors({});
    setVerifyAgain(false);
    setMode("verify");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const invalid = contactErrors(fields);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    store("sk-email-submission", submission.current);
    try {
      const result = await api(
        API_BASE,
        mode === "edit" ? "/api/rsvp/me" : "/api/rsvp",
        {
          method: mode === "edit" ? "PUT" : "POST",
          token: mode === "edit" ? token : undefined,
          body: {
            ...fields,
            consent: form.get("consent") === "on",
            website: form.get("website"),
            submission_id: submission.current,
            revision: record?.revision,
          },
        },
      );
      setToken("");
      // An idempotent retry acknowledges saving but never fetches private details.
      const saved = result.rsvp || {
        ...fields,
        email: fields.email.trim() || null,
      };
      store(RECEIPT_KEY, JSON.stringify(receiptFor(saved)));
      setRecord(saved);
      setMode("saved");
    } catch (e) {
      setError(e.message);
      setErrors(e.fields || {});
      setVerifyAgain(mode === "edit" && [401, 409].includes(e.status));
    } finally {
      setBusy(false);
    }
  }
  const update = (e) =>
    setFields((f) => ({ ...f, [e.target.name]: e.target.value }));
  return (
    <div
      className={`rsvp-flow ${leaving ? "state-leaving" : "state-arriving"}`}
    >
      {mode === "verify" ? (
        <OTPAccess
          initialPhone={fields.phone}
          initialEmail={fields.email}
          onCancel={() => setMode(record ? "saved" : "new")}
          onVerified={(result) => {
            setRecord(result.rsvp);
            setFields({
              ...EMPTY,
              ...result.rsvp,
              email: result.rsvp.email || "",
            });
            setToken(result.edit_token);
            setExpires(Date.now() + result.expires_in * 1000);
            setNow(Date.now());
            setMode("edit");
          }}
        />
      ) : (
        <>
          <ErrorCard message={error} />
          {verifyAgain && (
            <button type="button" className="button outline" onClick={verify}>
              Verify again to reload your response
            </button>
          )}
          {mode === "saved" ? (
            <RSVPConfirmation
              record={record}
              onEdit={verify}
              onNew={startNew}
            />
          ) : (
            <>
              {mode === "edit" && (
                <div className="edit-heading">
                  <h3>A little update?</h3>
                  <p className="small">
                    {now < expires
                      ? "Your response is open for editing for ten minutes."
                      : "Your editing session has expired. Verify again to continue."}
                  </p>
                  {now >= expires && (
                    <button
                      className="button outline"
                      type="button"
                      onClick={verify}
                    >
                      Send a fresh email code
                    </button>
                  )}
                </div>
              )}
              <form className="rsvp-form" onSubmit={submit}>
                <fieldset>
                  <legend>Will you celebrate with us?</legend>
                  <div className="choices">
                    {[
                      ["yes", "Joyfully attending"],
                      ["no", "Sadly unable to attend"],
                      ["maybe", "Not sure yet"],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className={
                          fields.attendance === value ? "selected" : ""
                        }
                      >
                        <input
                          type="radio"
                          name="attendance"
                          value={value}
                          checked={fields.attendance === value}
                          onChange={update}
                          required
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Your full name
                  <input
                    name="name"
                    value={fields.name}
                    onChange={update}
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby="name-error"
                  />
                  {errors.name && (
                    <small className="field-error" id="name-error">
                      {errors.name}
                    </small>
                  )}
                </label>
                <ContactFields
                  values={fields}
                  onChange={setFields}
                  errors={errors}
                />
                <label>
                  A little note for us (optional)
                  <textarea
                    name="message"
                    rows={3}
                    maxLength={500}
                    value={fields.message}
                    onChange={update}
                  />
                </label>
                <div className="honeypot" aria-hidden="true">
                  <label>
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <label className="consent">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    defaultChecked={mode === "edit"}
                  />
                  <span>
                    I agree to share these details with the couple for wedding
                    planning.
                  </span>
                </label>
                <p className="small">
                  Please check your phone number
                  {fields.email.trim() ? " and email address" : ""} before
                  sending.{" "}
                  {fields.email.trim()
                    ? "Your email will be used for future edit codes."
                    : "Without email, please contact us for changes."}
                </p>
                <button
                  className="button dark"
                  disabled={busy || (mode === "edit" && now >= expires)}
                >
                  {busy
                    ? "Saving your reply…"
                    : mode === "edit"
                      ? "Save my changes"
                      : "Send with love ↗"}
                </button>
                {mode === "edit" && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={endEdit}
                  >
                    Cancel editing
                  </button>
                )}
              </form>
              {mode === "new" && (
                <div className="returning-guest rsvp-edit-at-end">
                  <p>Already RSVP’d?</p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={verify}
                  >
                    Edit My RSVP
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
