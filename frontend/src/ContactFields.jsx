import React from "react";
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
} from "libphonenumber-js/min";
const names = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries().sort((a, b) =>
  names.of(a).localeCompare(names.of(b)),
);

// One shared country selector for guest submissions, verification and admin edits.
export function contactErrors(values) {
  const errors = {};
  let phone = values.phone.trim();
  if (values.country === "KE" && /^254[17]\d{8}$/.test(phone))
    phone = "+" + phone;
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (!isValidPhoneNumber(phone, values.country || "KE"))
    errors.phone = "Check the number and selected country.";
  if (
    values.email?.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  )
    errors.email = "Please check your email address.";
  return errors;
}
export default function ContactFields({
  values,
  onChange,
  errors = {},
  emailRequired = false,
  prefix = "contact",
  disabled = false,
}) {
  const update = (event) =>
    onChange({ ...values, [event.target.name]: event.target.value });
  return (
    <>
      <div className="phone-field-group">
        <div className="phone-inline-row">
          <label htmlFor={`${prefix}-country`}>
            Country code
            <select
              id={`${prefix}-country`}
              name="country"
              value={values.country || "KE"}
              onChange={update}
              disabled={disabled}
              autoComplete="country"
            >
              {countries.map((code) => (
                <option key={code} value={code}>
                  {names.of(code)} (+{getCountryCallingCode(code)})
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${prefix}-phone`}>
            Phone number
            <input
              id={`${prefix}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              maxLength={40}
              value={values.phone}
              onChange={update}
              disabled={disabled}
              placeholder={
                values.country === "KE" || !values.country
                  ? "701271155"
                  : "Your number"
              }
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={`${prefix}-phone-help`}
            />
          </label>
        </div>
        <small
          id={`${prefix}-phone-help`}
          className={errors.phone ? "field-error" : ""}
        >
          {errors.phone ||
            "Choose your country and enter your number. A full international number beginning with + also works."}
        </small>
      </div>
      <label htmlFor={`${prefix}-email`}>
        Email address {emailRequired ? "" : "(optional)"}
        <input
          id={`${prefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required={emailRequired}
          value={values.email || ""}
          onChange={update}
          disabled={disabled}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={`${prefix}-email-help`}
        />
        <small
          id={`${prefix}-email-help`}
          className={errors.email ? "field-error" : ""}
        >
          {errors.email ||
            (emailRequired
              ? "Use the email already registered with your RSVP."
              : "Add your email if you’d like to edit your RSVP later. We’ll send a verification code whenever you request an edit.")}
        </small>
      </label>
    </>
  );
}
