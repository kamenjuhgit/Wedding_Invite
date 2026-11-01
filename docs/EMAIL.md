# Email OTP setup

Sender: `Selam & Kamenju <invitations@selamandkamenju.com>`.

## What you must configure

1. Register/control selamandkamenju.com. It has not been purchased or configured by this code.
2. Choose a transactional email provider offering authenticated SMTP. Follow its account/domain verification process and confirm production sending is enabled (some accounts start in sandbox mode).
3. Add exactly the SPF/DKIM/domain-verification records provided by that service to your DNS. Do not create multiple SPF records. Configure DMARC appropriately for your domain.
4. Add backend settings:

```dotenv
MAIL_FROM=invitations@selamandkamenju.com
MAIL_REPLY_TO=
SMTP_HOST=YOUR_PROVIDER_SMTP_HOST
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USERNAME=YOUR_PROVIDER_USERNAME
SMTP_PASSWORD=YOUR_PROVIDER_PASSWORD_OR_SMTP_KEY
```

For providers using implicit TLS on port 465, use `SMTP_SECURITY=ssl`. SMTP is always encrypted and certificate-verified. Do not place credentials in frontend settings or share them in screenshots. Restart Flask after changing settings.

`MAIL_FROM` is configurable without editing code. A verified sending identity does not create an inbox. Set MAIL_REPLY_TO only to a real monitored mailbox if you want replies routed there.

## Guest behaviour

- First RSVP: no OTP, email optional.
- Edit: registered phone and email must match one record. Send only to that record's stored email, never a newly supplied recovery destination.
- Random four-digit code, expires 300 seconds after issue. The backend enforces the clock. A delayed email does not extend expiry.
- Five incorrect attempts per code; 30-second resend cooldown; at most three requests per email per 15 minutes, ten per day; IP and application-wide limits also apply.
- Codes are HMAC-protected with JWT_SECRET in SQLite, never returned from API or logged.
- Verified editing token lasts 600 seconds, remains only in browser memory, and is revoked after a successful save or cancel. Refresh requires another code.
- Saving changes to phone/email still applies uniqueness/validation. Removing email means future changes require admin assistance.
- Unknown/mismatched contacts receive a generic response; no guest details are exposed. Phone-only guests must contact the couple.

## Real delivery test before launch

Submit a test RSVP using your real email. Request a code; confirm sender name/address and receipt in inbox/spam. Test correct code, wrong code, resend, five-minute expiry and edit/save. Check the provider's delivery/bounce logs without sharing OTPs. SMTP acceptance means the provider accepted the message, not that it reached the inbox. Test more than one mailbox provider and an international guest address.

The automated suite uses a test-only in-memory email sender. It does not establish delivery, domain reputation or provider activation. Missing credentials and send failures are shown honestly; initial RSVPs continue to work. There is no SMS dependency or production console-code mode.

## Validation limits

`email-validator` checks syntax and DNS mail routing for new/changed contact submissions. DNS failures ask the user to retry. No SMTP mailbox probing is performed. `phonenumbers` checks international numbering structure, not ownership or whether a SIM is active.

References:
- https://pypi.org/project/email-validator/
- https://daviddrysdale.github.io/python-phonenumbers/
- https://docs.python.org/3/library/smtplib.html
