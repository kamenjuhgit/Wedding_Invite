"""Contact validation is shared by public and admin writes; it does not prove ownership."""

import re
import phonenumbers
from email_validator import validate_email, EmailNotValidError, caching_resolver

resolver = caching_resolver(timeout=5)


class Invalid(ValueError):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field


def normalize_phone(value, country="KE"):
    if not isinstance(value, str) or len(value) > 40 or not isinstance(country, str):
        raise Invalid("phone", "Enter a valid phone number.")
    value = re.sub(r"[\s().-]", "", value.strip())
    country = country.upper()
    if country not in phonenumbers.SUPPORTED_REGIONS:
        raise Invalid("country", "Choose your country.")
    if country == "KE" and re.fullmatch(r"254[17]\d{8}", value):
        value = "+" + value
    if value.startswith("00"):
        value = "+" + value[2:]
    if not re.fullmatch(r"\+?\d+", value):
        raise Invalid("phone", "Use digits and an optional + country code.")
    try:
        number = phonenumbers.parse(value, country)
        if not phonenumbers.is_valid_number(number):
            raise ValueError()
        return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
    except (ValueError, phonenumbers.NumberParseException):
        raise Invalid("phone", "Check the phone number and selected country.")


def normalize_email(value, check_dns=True):
    if value is None or value == "":
        return None
    if not isinstance(value, str) or len(value) > 254:
        raise Invalid("email", "Enter a valid email address or leave it blank.")
    value = value.strip()
    if not value:
        return None
    try:
        result = validate_email(
            value,
            check_deliverability=check_dns,
            allow_smtputf8=False,
            dns_resolver=resolver if check_dns else None,
        )
        # DNS timeouts are not evidence of deliverability; let the guest retry.
        if check_dns and not getattr(result, "mx", None):
            raise Invalid(
                "email", "We could not check this email domain. Please retry shortly."
            )
        return result.normalized.casefold()
    except EmailNotValidError as error:
        raise Invalid("email", str(error))


def fields(data, admin=False, check_dns=True):
    name, message = data.get("name", ""), data.get("message", "")
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 100:
        raise Invalid("name", "Please enter your full name (2–100 characters).")
    if not isinstance(message, str) or len(message) > 500:
        raise Invalid("message", "Keep your note within 500 characters.")
    attendance = data.get("attendance")
    if attendance not in (
        ("yes", "no", "maybe", "pending") if admin else ("yes", "no", "maybe")
    ):
        raise Invalid("attendance", "Please choose your response.")
    result = dict(
        name=name.strip(),
        phone=normalize_phone(data.get("phone"), data.get("country", "KE")),
        email=normalize_email(data.get("email"), check_dns),
        attendance=attendance,
        message=message.strip(),
    )
    if admin:
        count = data.get("guest_count")
        if count is not None and (type(count) is not int or not 0 <= count <= 1000):
            raise Invalid(
                "guest_count", "Use a whole number from 0 to 1000, or leave unassigned."
            )
        notes = data.get("admin_notes", "")
        if not isinstance(notes, str) or len(notes) > 2000:
            raise Invalid("admin_notes", "Keep private notes within 2000 characters.")
        result.update(guest_count=count, admin_notes=notes.strip())
    return result
