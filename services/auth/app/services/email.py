"""CONCIERTA Auth: módulo separado sin cambiar las reglas originales."""

import os
import smtplib
import ssl
from email.message import EmailMessage
from html import escape
from fastapi import HTTPException


def deliver_credentials(email: str, username: str, password: str):
    """Send credentials via Gmail. No console fallback and no secrets in API responses."""
    if os.getenv("MAIL_MODE", "smtp").lower() != "smtp":
        raise HTTPException(
            503,
            "El registro requiere el servicio de correo SMTP. Configura MAIL_MODE=smtp.",
        )
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    secure = os.getenv("SMTP_SECURE", "true").lower() == "true"
    sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
    username_smtp = os.getenv("SMTP_USER")
    secret = os.getenv("SMTP_APP_PASSWORD")
    if not all((sender, username_smtp, secret)):
        raise HTTPException(
            503, "El servicio de correo no está configurado. Contacta al administrador."
        )
    msg = EmailMessage()
    msg["Subject"] = "CONCIERTA | Bienvenido, tus credenciales de acceso"
    msg["From"] = sender
    msg["To"] = email
    msg.set_content(
        f"¡Bienvenido/a a CONCIERTA!\n\nTu cuenta ha sido creada correctamente.\n\nUsuario: {username}\nContraseña temporal: {password}\n\nInicia sesión con estos datos. Por seguridad, cambia tu contraseña después del primer acceso.\n\nSi no solicitaste esta cuenta, puedes ignorar este correo y contactar al administrador.\nEquipo CONCIERTA\n"
    )
    msg.add_alternative(
        f'<html><body style="margin:0;background:#100c1b;padding:34px;font-family:Arial,sans-serif"><table role="presentation" style="max-width:580px;margin:auto;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#24123e;padding:30px;color:white;font-size:26px;font-weight:bold">CONCIERTA <span style="color:#ee68bf">●</span></td></tr><tr><td style="padding:36px;color:#281b3b"><p style="color:#9b329f;font-weight:bold">BIENVENIDO A CONCIERTA</p><h1 style="font-size:26px">Tu cuenta está lista.</h1><p>Para acceder por primera vez utiliza estas credenciales:</p><div style="background:#f5effa;padding:20px;border-radius:10px"><p><b>Usuario:</b> {escape(username)}</p><p><b>Contraseña temporal:</b> {escape(password)}</p></div><p>Al iniciar sesión tendrás que establecer tu propia contraseña. La contraseña temporal dejará de funcionar después del cambio.</p><p style="color:#716581;font-size:12px">Si no solicitaste esta cuenta, contacta al administrador. No compartas tus credenciales.</p></td></tr><tr><td style="background:#f6f1fa;padding:20px;text-align:center;color:#716581;font-size:12px">CONCIERTA · Acceso seguro a experiencias en vivo</td></tr></table></body></html>',
        subtype="html",
    )
    try:
        if secure:
            with smtplib.SMTP_SSL(
                host, port, context=ssl.create_default_context(), timeout=15
            ) as smtp:
                smtp.login(username_smtp, secret)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(username_smtp, secret)
                smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        print(
            f"[SMTP] No se pudo entregar el correo a {email}: {type(exc).__name__}",
            flush=True,
        )
        raise HTTPException(
            502,
            "No se pudo enviar el correo de acceso. Intenta nuevamente en unos minutos.",
        )
