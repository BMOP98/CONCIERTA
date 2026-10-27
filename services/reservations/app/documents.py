"""On-demand PDF tickets and order summaries. No QR secrets appear in reports/logs."""

import io, os, ssl, smtplib, qrcode, httpx
from email.message import EmailMessage
from html import escape
from datetime import datetime
from zoneinfo import ZoneInfo
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

DARK = HexColor("#231336")
PURPLE = HexColor("#8d35b0")
GRAY = HexColor("#776b85")


def currency(n):
    return f"USD {float(n):,.2f}"


def event_date(d):
    try:
        return (
            datetime.fromisoformat(d.replace("Z", "+00:00"))
            .astimezone(ZoneInfo("America/Guayaquil"))
            .strftime("%d/%m/%Y · %H:%M (Ecuador)")
        )
    except Exception:
        return str(d)


def qr_png(t):
    b = io.BytesIO()
    qrcode.make(f"CONCIERTA:{t.id}:{t.qr_secret}").save(b, format="PNG")
    b.seek(0)
    return b


def decorate(c, heading, subtitle):
    w, h = 595, 842
    c.setFillColor(DARK)
    c.rect(0, h - 120, w, 120, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(45, h - 57, "CONCIERTA")
    c.setFillColor(HexColor("#f2a4df"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(45, h - 87, heading)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 10)
    c.drawString(45, 36, subtitle[:90])
    c.drawRightString(550, 36, "CONCIERTA · Documento digital")


def text(c, label, value, y):
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 10)
    c.drawString(45, y, label)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(45, y - 19, str(value)[:78])
    return y - 53


def ticket_pdf(r, t, event, section):
    b = io.BytesIO()
    c = canvas.Canvas(b, pagesize=(595, 842))
    decorate(c, "ENTRADA ELECTRÓNICA · ACCESO INDIVIDUAL", f"Boleto: {t.id}")
    y = 675
    for a, v in [
        ("CONCIERTO", event.get("name", "Concierto")),
        ("ARTISTA", event.get("artist", "")),
        ("FECHA Y HORA", event_date(event.get("date", ""))),
        ("LUGAR", event.get("scenario_name") or "Escenario CONCIERTA"),
        ("LOCALIDAD", section.get("name", "Localidad")),
        ("ASIENTO / ACCESO", t.seat_label),
        ("REFERENCIA", r.code),
        ("PRECIO", currency(t.unit_price)),
    ]:
        y = text(c, a, v, y)
    q = qr_png(t)
    c.drawImage(ImageReader(q), 225, 105, width=145, height=145)
    c.setFont("Helvetica", 9)
    c.setFillColor(GRAY)
    c.drawCentredString(297, 92, "QR personal · Preséntalo al ingresar · Un solo uso")
    c.save()
    return b.getvalue()


def summary_pdf(r, event, sections):
    b = io.BytesIO()
    c = canvas.Canvas(b, pagesize=(595, 842))
    decorate(c, "COMPROBANTE DE RESERVA CONFIRMADA", f"Reserva: {r.code}")
    y = 670
    for a, v in [
        ("NÚMERO DE RESERVA", r.code),
        ("EVENTO", event.get("name", "Concierto")),
        ("ARTISTA", event.get("artist", "")),
        ("FECHA Y HORA", event_date(event.get("date", ""))),
        ("ESTADO", "CONFIRMADA · Pago simulado"),
        ("ENTRADAS", len(r.tickets)),
    ]:
        y = text(c, a, v, y)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(45, y, "DETALLE DE LOCALIDADES")
    y -= 27
    for i, t in enumerate(r.tickets, 1):
        if y < 110:
            c.showPage()
            decorate(c, "CONTINUACIÓN DE RESERVA", f"Reserva: {r.code}")
            y = 670
        sec = sections.get(t.section_id, {})
        c.setFont("Helvetica", 11)
        c.setFillColor(DARK)
        c.drawString(48, y, f'{i}. {sec.get("name","Localidad")} / {t.seat_label}')
        c.drawRightString(545, y, currency(t.unit_price))
        y -= 24
    y -= 16
    c.setStrokeColor(HexColor("#d8cce3"))
    c.line(45, y, 550, y)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(45, y - 31, "TOTAL")
    c.drawRightString(545, y - 31, currency(r.total))
    c.setFont("Helvetica", 9)
    c.setFillColor(GRAY)
    c.save()
    return b.getvalue()


def send_confirmation(email, name, r, event, sections):
    """Return None when delivered, or raise for calling job to log retry requirement."""
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_APP_PASSWORD")
    sender = os.getenv("SMTP_FROM") or user
    if not user or not password or os.getenv("MAIL_MODE", "smtp").lower() != "smtp":
        raise RuntimeError("SMTP no configurado")
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = email
    msg["Subject"] = f"CONCIERTA | Confirmación {r.code} · Entradas y QR"
    detail = "\n".join(
        f'- {sections.get(t.section_id,{}).get("name","Localidad")} / {t.seat_label}'
        for t in r.tickets
    )
    msg.set_content(
        f'Hola {name},\n\nTu reserva {r.code} está CONFIRMADA.\nEvento: {event.get("name")}\nFecha: {event_date(event.get("date",""))}\nEntradas: {len(r.tickets)}\n{detail}\nTotal: {currency(r.total)}\n\nAdjuntamos un resumen de la reserva y un boleto PDF con QR por cada entrada. No compartas los códigos QR.\n\nCONCIERTA'
    )
    rows = "".join(
        f'<tr><td style="padding:10px;border-bottom:1px solid #e7deec">{escape(sections.get(t.section_id,{}).get("name","Localidad"))}</td><td style="padding:10px;border-bottom:1px solid #e7deec">{escape(t.seat_label)}</td><td style="padding:10px;border-bottom:1px solid #e7deec;text-align:right">{currency(t.unit_price)}</td></tr>'
        for t in r.tickets
    )
    msg.add_alternative(
        f"""<html><body style="background:#f2ecf7;margin:0;padding:35px;font-family:Arial,sans-serif"><table role="presentation" style="max-width:630px;margin:auto;background:white;border-radius:16px;overflow:hidden"><tr><td style="background:#221333;color:white;padding:34px;font-size:28px;font-weight:bold">CONCIERTA <span style="color:#fa80c5">●</span></td></tr><tr><td style="padding:36px"><p style="font-size:12px;color:#9636ae;font-weight:bold">RESERVA CONFIRMADA</p><h1 style="font-size:27px;color:#281839">¡Nos vemos en el concierto!</h1><p style="color:#655874">Hola {escape(name)}, tus {len(r.tickets)} entradas están confirmadas. En este correo encontrarás tus documentos PDF y un código QR individual para cada acceso.</p><div style="padding:18px;background:#f5eff9;border-radius:9px;color:#362346"><b>{escape(event.get('name','Concierto'))}</b><br>{escape(event.get('artist',''))}<br>{escape(event_date(event.get('date','')))}<br>Reserva: {escape(r.code)}</div><table style="width:100%;margin-top:22px;border-collapse:collapse;color:#382847"><tr><th style="text-align:left">Localidad</th><th style="text-align:left">Asiento</th><th style="text-align:right">Precio</th></tr>{rows}</table><p style="font-size:20px;text-align:right;color:#2c193b"><b>Total: {currency(r.total)}</b></p><p style="color:#706181;font-size:13px">Adjuntos: comprobante general y {len(r.tickets)} entradas electrónicas con QR. Cada QR es único y de un solo uso. No lo compartas.</p></td></tr><tr><td style="text-align:center;padding:20px;background:#f5eff9;color:#8b7b98;font-size:12px">CONCIERTA · Tu música, tu lugar</td></tr></table></body></html>""",
        subtype="html",
    )
    msg.add_attachment(
        summary_pdf(r, event, sections),
        maintype="application",
        subtype="pdf",
        filename=f"CONCIERTA-{r.code}-resumen.pdf",
    )
    for i, t in enumerate(r.tickets, 1):
        msg.add_attachment(
            ticket_pdf(r, t, event, sections.get(t.section_id, {})),
            maintype="application",
            subtype="pdf",
            filename=f"CONCIERTA-{r.code}-entrada-{i}.pdf",
        )
    context = ssl.create_default_context()
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "465"))
    if os.getenv("SMTP_SECURE", "true").lower() == "true":
        with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls(context=context)
            smtp.login(user, password)
            smtp.send_message(msg)
