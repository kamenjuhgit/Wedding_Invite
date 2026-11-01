"""Provider-neutral transactional SMTP. Credentials belong only on the Flask host."""

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr


def ready(app):
    return bool(
        (app.testing and app.config.get("EMAIL_SENDER"))
        or all(
            app.config.get(key)
            for key in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "MAIL_FROM")
        )
    )


def send_code(app, recipient, code):
    # Tests capture mail in memory. Production never prints/returns a verification code.
    if app.testing and app.config.get("EMAIL_SENDER"):
        return app.config["EMAIL_SENDER"](recipient, code)
    message = EmailMessage()
    message["From"] = formataddr(("Selam & Kamenju", app.config["MAIL_FROM"]))
    message["To"] = recipient
    message["Subject"] = "Your RSVP verification code"
    if app.config.get("MAIL_REPLY_TO"):
        message["Reply-To"] = app.config["MAIL_REPLY_TO"]
    message.set_content(
        f"Your Selam & Kamenju RSVP edit code is {code}.\n\nIt expires in 5 minutes. Do not share this code.\nIf you did not request it, you can ignore this email."
    )
    message.add_alternative(
        f"""<html><body style="background:#f8f4eb;color:#465c3d;font-family:Georgia,serif;padding:32px"><main style="max-width:480px;margin:auto;border:1px solid #a2ad94;padding:32px;text-align:center"><p>SELAM &amp; KAMENJU</p><h1>A little verification</h1><p>Your RSVP edit code</p><p style="font-size:38px;letter-spacing:10px">{code}</p><p>Valid for five minutes. Please do not share it.</p><p>If you did not request this, you can ignore this email.</p></main></body></html>""",
        subtype="html",
    )
    context = ssl.create_default_context()
    mode = app.config["SMTP_SECURITY"]
    factory = smtplib.SMTP_SSL if mode == "ssl" else smtplib.SMTP
    args = dict(host=app.config["SMTP_HOST"], port=app.config["SMTP_PORT"], timeout=10)
    if mode == "ssl":
        args["context"] = context
    with factory(**args) as server:
        if mode == "starttls":
            server.starttls(context=context)
        server.login(app.config["SMTP_USERNAME"], app.config["SMTP_PASSWORD"])
        if server.send_message(message):
            raise RuntimeError("Recipient rejected")
