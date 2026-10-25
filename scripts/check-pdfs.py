"""Quick offline smoke test of PDF generation; run from services/reservations with its venv."""
from types import SimpleNamespace
from app.documents import ticket_pdf,summary_pdf
r=SimpleNamespace(code='CON-TEST',total=75,tickets=[])
t=SimpleNamespace(id='test-qr',qr_secret='demo',seat_label='A12',unit_price=75,section_id=1)
r.tickets=[t]
e={'name':'Concierto de prueba','artist':'Artista invitado','date':'2026-12-12T20:00:00Z'}
for data in [ticket_pdf(r,t,e,{'name':'VIP'}),summary_pdf(r,e,{1:{'name':'VIP'}})]:
 assert data.startswith(b'%PDF-') and len(data)>1000
print('OK: boleto con QR y resumen PDF generados')
