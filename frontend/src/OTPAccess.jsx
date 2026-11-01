import React, { useEffect, useState } from "react";
import { api, API_BASE } from "./api";
import ContactFields, { contactErrors } from "./ContactFields";
import ErrorCard from "./ErrorCard";
export default function OTPAccess({
  initialPhone = "",
  initialEmail = "",
  onVerified,
  onCancel,
}) {
  const [fields, setFields] = useState({
    country: "KE",
    phone: initialPhone,
    email: initialEmail,
  });
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [deadline, setDeadline] = useState(0),
    [resendAt, setResendAt] = useState(0),
    [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState({});
  const [note, setNote] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  async function send(event) {
    event.preventDefault();
    if (busy) return;
    const invalid = contactErrors(fields);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    setError("");
    // A failed resend must not leave an invalidated earlier code looking usable.
    setChallenge("");
    setCode("");
    try {
      const result = await api(API_BASE, "/api/rsvp/otp/request", {
        method: "POST",
        body: fields,
      });
      setChallenge(result.challenge);
      setDeadline(Date.now() + result.expires_in * 1000);
      setResendAt(Date.now() + result.resend_after * 1000);
      setNow(Date.now());
      setNote(result.message);
    } catch (e) {
      setError(e.message);
      setErrors(e.fields || {});
      setResendAt(Date.now() + 30000);
    } finally {
      setBusy(false);
    }
  }
  async function verify(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onVerified(
        await api(API_BASE, "/api/rsvp/otp/verify", {
          method: "POST",
          body: { challenge, code },
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="otp-card">
      <h3>A little verification</h3>
      <p>
        Your reply, safely yours. A five-minute email code protects every edit.
      </p>
      <form onSubmit={send}>
        <ContactFields
          prefix="verify"
          values={fields}
          emailRequired
          errors={errors}
          disabled={busy}
          onChange={(next) => {
            setFields(next);
            setChallenge("");
            setNote("");
          }}
        />
        <button className="button outline" disabled={busy || now < resendAt}>
          {busy
            ? "Please wait…"
            : now < resendAt
              ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s`
              : challenge
                ? "Send a new code"
                : "Send email code"}
        </button>
      </form>
      {challenge && (
        <form onSubmit={verify}>
          <p role="status" className="small">
            {note}
          </p>
          <p className="code-timer">
            {seconds
              ? `Code expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
              : "Your code has expired. Request a new one."}
          </p>
          <label>
            Four-digit email code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button className="button dark" disabled={busy || !seconds}>
            Verify and edit
          </button>
        </form>
      )}
      <ErrorCard message={error} />
      <p className="small">
        If you RSVP’d without an email, please contact Selam or Kamenju for
        changes.
      </p>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={onCancel}
      >
        Back to RSVP
      </button>
    </div>
  );
}
